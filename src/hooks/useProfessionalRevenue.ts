import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BillingCycle, RevenuePeriod, RevenueRow, RevenueSummary } from '../types/billing'

// FASE P1-A — extrato de recebimentos da Professional.
//
// Fonte ÚNICA: `public.subscription_payouts` (escrito só pela Edge Function
// `asaas-webhook`). A RLS (`subscription_payouts_select` = `is_master() OR
// professional_id = auth.uid() OR owns_community(...)`) já limita as linhas
// à Professional. Complementa com:
//   • `subscriptions` — `circula_percent_snapshot`, `billing_cycle_snapshot`,
//     `profile_id` (Member);   RLS: `owns_community` libera as da comunidade.
//   • `profiles` — `full_name` do Member;   RLS `profiles_select` libera via
//     `community_owner_of_profile`.
//
// NUNCA lê: walletId, asaas_customer_id, API key, dados bancários, nem
// linhas de outra comunidade. 3 consultas planas (sem embed) por robustez.
// `useProfessionalRevenue(null)` não faz fetch.

interface PayoutRaw {
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

    const { data: payoutData, error: payoutError } = await supabase
      .from('subscription_payouts')
      .select(
        'id, kind, split_model, status, created_at, reversed_at, gross_amount_cents, asaas_fee_cents, circula_fee_cents, net_amount_cents, subscription_id',
      )
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (payoutError) {
      setError('Não foi possível carregar os recebimentos.')
      setRows([])
      setLoading(false)
      return
    }

    const payouts = (payoutData as PayoutRaw[] | null) ?? []
    if (payouts.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const subIds = [...new Set(payouts.map((p) => p.subscription_id))]
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('id, profile_id, circula_percent_snapshot, billing_cycle_snapshot')
      .in('id', subIds)
    const subs = (subData as SubRaw[] | null) ?? []
    const subById = new Map(subs.map((s) => [s.id, s]))

    const memberIds = [...new Set(subs.map((s) => s.profile_id))]
    const nameById = new Map<string, string | null>()
    if (memberIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds)
      for (const p of (profData as { id: string; full_name: string | null }[] | null) ?? []) {
        nameById.set(p.id, p.full_name)
      }
    }

    const mapped: RevenueRow[] = payouts.map((p) => {
      const sub = subById.get(p.subscription_id)
      return {
        id: p.id,
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
        memberName: sub ? (nameById.get(sub.profile_id) ?? null) : null,
      }
    })

    setRows(mapped)
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
