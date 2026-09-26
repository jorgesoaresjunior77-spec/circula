import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BillingCycle, RevenuePeriod, RevenueRow, RevenueSummary } from '../types/billing'

// FASE P1-A — extrato de recebimentos da Professional.
// FASE P1-D — mescla DUAS fontes, cada uma escrita só pela Edge Function
// `asaas-webhook`:
//   • `subscription_payouts` — assinatura de comunidade. RLS
//     (`subscription_payouts_select` = `is_master() OR professional_id =
//     auth.uid() OR owns_community(...)`) já limita as linhas à Professional.
//     Complementa com `subscriptions` (circula_percent_snapshot,
//     billing_cycle_snapshot, profile_id do Member) + `profiles` (nome).
//   • `product_payouts` — venda de produto da Loja (fora do checkout
//     Hotmart, que não gera pedido interno). RLS
//     (`product_payouts_select` = `owns_community(...) OR is_master()`)
//     mesmo padrão. Complementa com `product_orders`
//     (product_title_snapshot, buyer_profile_id, circula_percent_snapshot
//     — já tudo no próprio pedido, sem precisar de outra tabela) +
//     `profiles` (nome de quem comprou).
//
// NUNCA lê: walletId, asaas_customer_id, API key, dados bancários, nem
// linhas de outra comunidade. Consultas planas (sem embed) por robustez.
// `useProfessionalRevenue(null)` não faz fetch.

interface SubscriptionPayoutRaw {
  id: string
  kind: 'sale' | 'reversal'
  split_model: 'native' | 'ledger'
  status: 'paid' | 'pending' | 'reversed'
  created_at: string
  reversed_at: string | null
  gross_amount_cents: number
  asaas_fee_cents: number
  circula_fee_cents: number
  net_amount_cents: number
  subscription_id: string
}

interface SubRaw {
  id: string
  profile_id: string
  circula_percent_snapshot: number | null
  billing_cycle_snapshot: BillingCycle | null
}

interface ProductPayoutRaw {
  id: string
  kind: 'sale' | 'reversal'
  split_model: 'native' | 'ledger'
  status: 'paid' | 'pending' | 'reversed'
  created_at: string
  reversed_at: string | null
  gross_amount_cents: number
  asaas_fee_cents: number
  circula_fee_cents: number
  net_amount_cents: number
  order_id: string
}

interface OrderRaw {
  id: string
  product_title_snapshot: string
  buyer_profile_id: string
  circula_percent_snapshot: number | null
}

function periodStartISO(period: RevenuePeriod): string | null {
  const now = new Date()
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000).toISOString()
  if (period === '90d') return new Date(now.getTime() - 90 * 86400000).toISOString()
  if (period === 'year') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString()
  return null // 'all'
}

const EMPTY_SUMMARY: RevenueSummary = {
  professionalPaidCents: 0,
  professionalPendingCents: 0,
  circulaPaidCents: 0,
  grossPaidCents: 0,
  asaasFeePaidCents: 0,
  paidCount: 0,
  pendingCount: 0,
  reversedCount: 0,
  lastPayout: null,
}

export function useProfessionalRevenue(communityId: string | null) {
  const [rows, setRows] = useState<RevenueRow[]>([])
  const [loading, setLoading] = useState(!!communityId)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<RevenuePeriod>('30d')

  const refresh = useCallback(async () => {
    if (!communityId) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)

    const [subPayoutsResult, productPayoutsResult] = await Promise.all([
      supabase
        .from('subscription_payouts')
        .select(
          'id, kind, split_model, status, created_at, reversed_at, gross_amount_cents, asaas_fee_cents, circula_fee_cents, net_amount_cents, subscription_id',
        )
        .eq('community_id', communityId)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_payouts')
        .select(
          'id, kind, split_model, status, created_at, reversed_at, gross_amount_cents, asaas_fee_cents, circula_fee_cents, net_amount_cents, order_id',
        )
        .eq('community_id', communityId)
        .order('created_at', { ascending: false }),
    ])

    if (subPayoutsResult.error || productPayoutsResult.error) {
      setError('Não foi possível carregar os recebimentos.')
      setRows([])
      setLoading(false)
      return
    }

    const subscriptionPayouts = (subPayoutsResult.data as SubscriptionPayoutRaw[] | null) ?? []
    const productPayouts = (productPayoutsResult.data as ProductPayoutRaw[] | null) ?? []

    const subIds = [...new Set(subscriptionPayouts.map((p) => p.subscription_id))]
    const orderIds = [...new Set(productPayouts.map((p) => p.order_id))]

    const [subsResult, ordersResult] = await Promise.all([
      subIds.length > 0
        ? supabase
            .from('subscriptions')
            .select('id, profile_id, circula_percent_snapshot, billing_cycle_snapshot')
            .in('id', subIds)
        : Promise.resolve({ data: [] as SubRaw[] }),
      orderIds.length > 0
        ? supabase
            .from('product_orders')
            .select('id, product_title_snapshot, buyer_profile_id, circula_percent_snapshot')
            .in('id', orderIds)
        : Promise.resolve({ data: [] as OrderRaw[] }),
    ])

    const subs = (subsResult.data as SubRaw[] | null) ?? []
    const subById = new Map(subs.map((s) => [s.id, s]))
    const orders = (ordersResult.data as OrderRaw[] | null) ?? []
    const orderById = new Map(orders.map((o) => [o.id, o]))

    const payerIds = [
      ...new Set([...subs.map((s) => s.profile_id), ...orders.map((o) => o.buyer_profile_id)]),
    ]
    const nameById = new Map<string, string | null>()
    if (payerIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', payerIds)
      for (const p of (profData as { id: string; full_name: string | null }[] | null) ?? []) {
        nameById.set(p.id, p.full_name)
      }
    }

    const subscriptionRows: RevenueRow[] = subscriptionPayouts.map((p) => {
      const sub = subById.get(p.subscription_id)
      return {
        id: p.id,
        source: 'subscription',
        kind: p.kind,
        splitModel: p.split_model,
        status: p.status,
        createdAt: p.created_at,
        reversedAt: p.reversed_at,
        grossCents: p.gross_amount_cents,
        asaasFeeCents: p.asaas_fee_cents,
        circulaFeeCents: p.circula_fee_cents,
        netAmountCents: p.net_amount_cents,
        netValueCents: Math.max(0, p.gross_amount_cents - p.asaas_fee_cents),
        circulaPercent: sub?.circula_percent_snapshot ?? null,
        billingCycle: sub?.billing_cycle_snapshot ?? null,
        subscriptionId: p.subscription_id,
        productTitle: null,
        memberName: sub ? (nameById.get(sub.profile_id) ?? null) : null,
      }
    })

    const productRows: RevenueRow[] = productPayouts.map((p) => {
      const order = orderById.get(p.order_id)
      return {
        id: p.id,
        source: 'product',
        kind: p.kind,
        splitModel: p.split_model,
        status: p.status,
        createdAt: p.created_at,
        reversedAt: p.reversed_at,
        grossCents: p.gross_amount_cents,
        asaasFeeCents: p.asaas_fee_cents,
        circulaFeeCents: p.circula_fee_cents,
        netAmountCents: p.net_amount_cents,
        netValueCents: Math.max(0, p.gross_amount_cents - p.asaas_fee_cents),
        circulaPercent: order?.circula_percent_snapshot ?? null,
        billingCycle: null,
        subscriptionId: null,
        productTitle: order?.product_title_snapshot ?? null,
        memberName: order ? (nameById.get(order.buyer_profile_id) ?? null) : null,
      }
    })

    const merged = [...subscriptionRows, ...productRows].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )

    setRows(merged)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    const start = periodStartISO(period)
    if (!start) return rows
    return rows.filter((r) => r.createdAt >= start)
  }, [rows, period])

  const summary = useMemo<RevenueSummary>(() => {
    if (filteredRows.length === 0) return EMPTY_SUMMARY
    const s = { ...EMPTY_SUMMARY }
    for (const r of filteredRows) {
      if (r.kind === 'reversal') {
        s.reversedCount += 1
        s.professionalPaidCents -= r.netAmountCents
        s.circulaPaidCents -= r.circulaFeeCents
        s.grossPaidCents -= r.grossCents
        s.asaasFeePaidCents -= r.asaasFeeCents
        continue
      }
      if (r.status === 'paid') {
        s.paidCount += 1
        s.professionalPaidCents += r.netAmountCents
        s.circulaPaidCents += r.circulaFeeCents
        s.grossPaidCents += r.grossCents
        s.asaasFeePaidCents += r.asaasFeeCents
      } else if (r.status === 'pending') {
        s.pendingCount += 1
        s.professionalPendingCents += r.netAmountCents
      }
    }
    s.professionalPaidCents = Math.max(0, s.professionalPaidCents)
    s.circulaPaidCents = Math.max(0, s.circulaPaidCents)
    s.grossPaidCents = Math.max(0, s.grossPaidCents)
    s.asaasFeePaidCents = Math.max(0, s.asaasFeePaidCents)
    // "último recebimento" = o sale mais recente (linhas já vêm por
    // created_at desc); uma reversão não é um recebimento.
    const last = filteredRows.find((r) => r.kind === 'sale') ?? null
    s.lastPayout = last
      ? {
          createdAt: last.createdAt,
          netAmountCents: last.netAmountCents,
          status: last.status,
          kind: last.kind,
        }
      : null
    return s
  }, [filteredRows])

  return { rows: filteredRows, summary, loading, error, period, setPeriod, refresh }
}
