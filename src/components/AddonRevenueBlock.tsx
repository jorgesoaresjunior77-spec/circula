import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PACKAGE_LABEL } from '../lib/packages'
import type { PackageKey } from '../lib/packages'

// Recebimentos das assinaturas de conteúdos, da cesta e do Círcula Premium (tabela addon_payments, gravada
// só pelo webhook do Asaas). Fica separado do extrato da assinatura da comunidade e da Loja porque não tem
// divisão automática entre profissional e Círcula: aqui aparece o bruto, a taxa e o líquido de cada pagamento.

interface Row {
  id: string
  status: string
  amount_cents: number
  net_value_cents: number | null
  due_date: string | null
  paid_at: string | null
  installment_number: number | null
  addon_subscription_id: string
}

interface SubInfo {
  id: string
  plan_key: string
  billing_cycle: string
  installment_count: number | null
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (c: number) => BRL.format(c / 100)
const PAID = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])
const CYCLE: Record<string, string> = { MONTHLY: 'Mensal', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' }

function planName(key: string): string {
  if (key === 'cesta') return 'Cesta de conteúdos'
  return PACKAGE_LABEL[key as PackageKey] ?? key
}

export function AddonRevenueBlock({ communityId }: { communityId: string | null }) {
  const [rows, setRows] = useState<Row[]>([])
  const [subs, setSubs] = useState<Map<string, SubInfo>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!communityId) return
    let alive = true
    void (async () => {
      const { data, error: e } = await supabase
        .from('addon_payments')
        .select('id, status, amount_cents, net_value_cents, due_date, paid_at, installment_number, addon_subscription_id')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (!alive) return
      if (e) {
        setError('Não foi possível carregar os pagamentos de conteúdos e Premium.')
        return
      }
      const list = (data as Row[] | null) ?? []
      setRows(list)
      const ids = [...new Set(list.map((r) => r.addon_subscription_id))]
      if (ids.length === 0) return
      const { data: s } = await supabase.from('addon_subscriptions').select('id, plan_key, billing_cycle, installment_count').in('id', ids)
      if (alive) setSubs(new Map(((s as SubInfo[] | null) ?? []).map((x) => [x.id, x])))
    })()
    return () => {
      alive = false
    }
  }, [communityId])

  if (!communityId) return null
  const paid = rows.filter((r) => PAID.has(r.status))
  const gross = paid.reduce((t, r) => t + r.amount_cents, 0)
  const net = paid.reduce((t, r) => t + (r.net_value_cents ?? r.amount_cents), 0)

  return (
    <section className="revenue-addons" aria-label="Conteúdos e Premium">
      <h3>Conteúdos, cesta e Premium</h3>
      {error && <p className="auth-error">{error}</p>}
      {!error && rows.length === 0 && <p className="revenue-empty">Nenhum pagamento de conteúdo ou Premium registrado ainda.</p>}
      {rows.length > 0 && (
        <>
          <p className="revenue-hint">
            Recebido: <strong>{money(gross)}</strong> bruto · <strong>{money(net)}</strong> líquido em {paid.length}{' '}
            {paid.length === 1 ? 'pagamento' : 'pagamentos'}.
          </p>
          <div className="revenue-table-wrap">
            <table className="revenue-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Plano</th>
                  <th>Situação</th>
                  <th className="revenue-num">Bruto</th>
                  <th className="revenue-num">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sub = subs.get(r.addon_subscription_id)
                  const parcel = sub && (sub.installment_count ?? 1) > 1 && r.installment_number ? ` · parcela ${r.installment_number}/${sub.installment_count}` : ''
                  return (
                    <tr key={r.id}>
                      <td data-label="Data">{new Date(r.paid_at ?? `${r.due_date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                      <td data-label="Plano">
                        {sub ? `${planName(sub.plan_key)} · ${CYCLE[sub.billing_cycle] ?? sub.billing_cycle}${parcel}` : '—'}
                      </td>
                      <td data-label="Situação">{PAID.has(r.status) ? 'Pago' : r.status === 'OVERDUE' ? 'Em atraso' : r.status === 'PENDING' ? 'Pendente' : r.status}</td>
                      <td data-label="Bruto" className="revenue-num">
                        {money(r.amount_cents)}
                      </td>
                      <td data-label="Líquido" className="revenue-num">
                        {r.net_value_cents == null ? '—' : money(r.net_value_cents)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
