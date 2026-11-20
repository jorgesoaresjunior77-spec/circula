import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { brDate } from '../../lib/nutri'
import { formatBrl } from '../../lib/plansCatalog'
import { PACKAGE_LABEL } from '../../lib/packages'
import type { PackageKey } from '../../lib/packages'

// Assinatura e pagamentos da paciente (só a nutricionista vê): plano, ciclo,
// valor, situação, próxima cobrança, forma de pagamento e últimos pagamentos.
// Os dados vêm do que o Círcula já registra (assinatura e cobranças da Asaas).

interface Billing {
  linked: boolean
  exempt?: boolean
  subscription: null | {
    plan_name: string | null
    status: string
    cycle: string | null
    price_cents: number | null
    current_period_end: string | null
    trial_ends_at: string | null
    via_asaas: boolean
  }
  charges?: { due_date: string; amount_cents: number; status: string; billing_type: string | null; paid_at: string | null }[]
  addons?: { plan_key: string; billing_cycle: string; status: string; current_period_end: string | null }[]
}

const STATUS: Record<string, string> = { trial: 'Em teste gratuito', active: 'Ativa', past_due: 'Pagamento em atraso', canceled: 'Cancelada', blocked: 'Bloqueada' }
const CYCLE: Record<string, string> = { monthly: 'Mensal', MONTHLY: 'Mensal', semiannual: 'Semestral', SEMIANNUALLY: 'Semestral', annual: 'Anual', YEARLY: 'Anual' }
const METHOD: Record<string, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', UNDEFINED: 'A escolher no pagamento' }
const CHARGE: Record<string, string> = { PENDING: 'Aguardando', RECEIVED: 'Pago', CONFIRMED: 'Pago', OVERDUE: 'Em atraso', REFUNDED: 'Estornado', RECEIVED_IN_CASH: 'Pago' }

export function BillingTab({ patientId }: { patientId: string }) {
  const [data, setData] = useState<Billing | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('nutri_patient_billing', { p_patient: patientId }).then(({ data: d, error }) => {
      if (!cancelled) setData(error ? null : (d as Billing))
    })
    return () => {
      cancelled = true
    }
  }, [patientId])

  if (data === undefined) return <p className="home-muted">Carregando…</p>
  if (data === null) return <p className="auth-error">Não foi possível carregar a assinatura agora.</p>
  if (!data.linked) return <p className="home-muted">Para ver o plano e os pagamentos, vincule a paciente a uma participante na aba Dados pessoais.</p>

  const s = data.subscription
  const last = data.charges?.[0]
  return (
    <div className="nutri-billing">
      {data.exempt && <p className="ml-chip">Isenta da assinatura do Círcula (100%)</p>}
      <h3>Plano do Círcula</h3>
      {!s ? (
        <p className="home-muted">Ainda sem assinatura registrada.</p>
      ) : (
        <dl className="nutri-facts-grid">
          <div className="nutri-fact"><dt>Plano</dt><dd>{s.plan_name ?? 'Círcula'}</dd></div>
          <div className="nutri-fact"><dt>Situação</dt><dd>{data.exempt ? 'Isenta' : (STATUS[s.status] ?? s.status)}</dd></div>
          <div className="nutri-fact"><dt>Ciclo de cobrança</dt><dd>{s.cycle ? (CYCLE[s.cycle] ?? s.cycle) : '—'}</dd></div>
          <div className="nutri-fact"><dt>Valor</dt><dd>{data.exempt ? 'R$ 0,00 (isenção)' : s.price_cents != null ? formatBrl(s.price_cents) : '—'}</dd></div>
          <div className="nutri-fact"><dt>Parcelas</dt><dd>{s.cycle && s.cycle !== 'monthly' && s.cycle !== 'MONTHLY' ? 'Cobrança única no ciclo (sem parcelamento registrado)' : 'Cobrança mensal recorrente'}</dd></div>
          <div className="nutri-fact"><dt>Forma de pagamento</dt><dd>{last?.billing_type ? (METHOD[last.billing_type] ?? last.billing_type) : s.via_asaas ? 'A escolher no pagamento' : '—'}</dd></div>
          <div className="nutri-fact"><dt>{s.status === 'trial' ? 'Teste termina em' : 'Próxima cobrança / fim do período'}</dt><dd>{s.status === 'trial' ? brDate(s.trial_ends_at) : brDate(s.current_period_end)}</dd></div>
        </dl>
      )}

      {(data.addons ?? []).length > 0 && (
        <>
          <h3>Conteúdos extras assinados</h3>
          <ul className="pn-list">
            {data.addons!.map((a, i) => (
              <li key={i}>
                <strong>{PACKAGE_LABEL[a.plan_key as PackageKey] ?? a.plan_key}</strong>{' '}
                <span className="home-muted">
                  {STATUS[a.status] ?? a.status} · {CYCLE[a.billing_cycle] ?? a.billing_cycle}
                  {a.current_period_end ? ` · até ${brDate(a.current_period_end)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Últimos pagamentos</h3>
      {(data.charges ?? []).length === 0 ? (
        <p className="home-muted">Nenhum pagamento registrado ainda.</p>
      ) : (
        <div className="pn-table-wrap">
          <table className="nutri-compare">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Forma</th>
                <th>Pago em</th>
              </tr>
            </thead>
            <tbody>
              {data.charges!.map((c, i) => (
                <tr key={i}>
                  <td>{brDate(c.due_date)}</td>
                  <td>{formatBrl(c.amount_cents)}</td>
                  <td>{CHARGE[c.status] ?? c.status}</td>
                  <td>{c.billing_type ? (METHOD[c.billing_type] ?? c.billing_type) : '—'}</td>
                  <td>{c.paid_at ? brDate(c.paid_at.slice(0, 10)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
