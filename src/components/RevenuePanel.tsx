import { useProfessionalBillingAccount } from '../hooks/useProfessionalBillingAccount'
import { useProfessionalRevenue } from '../hooks/useProfessionalRevenue'
import type { BillingCycle, PayoutKind, PayoutStatus, RevenuePeriod } from '../types/billing'

// FASE P1-A — aba "Recebimentos" do painel da Professional.
// Somente leitura. Deriva de `subscription_payouts` (via useProfessionalRevenue).
// Não faz nenhuma chamada ao Asaas; não expõe walletId/credencial.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents: number) => BRL.format(cents / 100)

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string) => DATE_FMT.format(new Date(iso))

const PERIOD_OPTIONS: { label: string; value: RevenuePeriod }[] = [
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
  { label: 'Este ano', value: 'year' },
  { label: 'Todo o período', value: 'all' },
]

const CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
}

function statusLabel(kind: PayoutKind, status: PayoutStatus): { text: string; tone: string } {
  if (kind === 'reversal') return { text: 'Revertido', tone: 'revenue-badge--reversed' }
  if (status === 'paid') return { text: 'Pago', tone: 'revenue-badge--paid' }
  if (status === 'pending') return { text: 'Pendente', tone: 'revenue-badge--pending' }
  return { text: status, tone: '' }
}

interface RevenuePanelProps {
  communityId: string
  communityName: string
}

export function RevenuePanel({ communityId, communityName }: RevenuePanelProps) {
  const { rows, summary, loading, error, period, setPeriod } = useProfessionalRevenue(communityId)
  const { connected, loading: accountLoading } = useProfessionalBillingAccount(true)

  return (
    <section className="revenue-panel">
      <p className="section-label">Recebimentos da comunidade</p>

      {/* Conta Asaas — informativo, NUNCA bloqueia a visualização do histórico. */}
      {!accountLoading && !connected && (
        <p className="revenue-account-note">
          Conecte sua conta Asaas para receber pagamentos da comunidade. Os recebimentos já
          registrados continuam visíveis abaixo.
        </p>
      )}

      <div className="metrics-period">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`metrics-period-button${
              period === option.value ? ' metrics-period-button--active' : ''
            }`}
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <p>Carregando recebimentos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="metrics-stats revenue-stats">
            <div className="metric-tile">
              <p className="metric-tile-value">{money(summary.professionalPaidCents)}</p>
              <p className="metric-tile-label">Você recebeu</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{money(summary.professionalPendingCents)}</p>
              <p className="metric-tile-label">A repassar</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{money(summary.circulaPaidCents)}</p>
              <p className="metric-tile-label">Foi para o Círcula</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{summary.paidCount}</p>
              <p className="metric-tile-label">Recebimentos pagos</p>
            </div>
          </div>

          {summary.lastPayout && (
            <p className="revenue-last">
              Último recebimento: <strong>{fmtDate(summary.lastPayout.createdAt)}</strong> —{' '}
              {money(summary.lastPayout.netAmountCents)} (
              {statusLabel(summary.lastPayout.kind, summary.lastPayout.status).text.toLowerCase()}).
            </p>
          )}

          {rows.length === 0 ? (
            <p className="revenue-empty">
              Ainda não há recebimentos neste período. Eles aparecem aqui quando um pagamento de
              assinatura de <strong>{communityName}</strong> é confirmado pela Asaas.
            </p>
          ) : (
            <div className="revenue-table-wrap">
              <table className="revenue-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Membro</th>
                    <th>Assinatura</th>
                    <th className="revenue-num">Bruto</th>
                    <th className="revenue-num">Taxa Asaas</th>
                    <th className="revenue-num">Líquido</th>
                    <th className="revenue-num">% Círcula</th>
                    <th className="revenue-num">Círcula</th>
                    <th className="revenue-num">Você</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const badge = statusLabel(r.kind, r.status)
                    return (
                      <tr key={r.id}>
                        <td data-label="Data">{fmtDate(r.createdAt)}</td>
                        <td data-label="Membro">{r.memberName ?? '—'}</td>
                        <td data-label="Assinatura">
                          {(r.billingCycle && CYCLE_LABEL[r.billingCycle]) || 'Assinatura'} ·{' '}
                          {r.subscriptionId.slice(0, 8)}
                        </td>
                        <td data-label="Bruto" className="revenue-num">
                          {money(r.grossCents)}
                        </td>
                        <td data-label="Taxa Asaas" className="revenue-num">
                          {money(r.asaasFeeCents)}
                        </td>
                        <td data-label="Líquido" className="revenue-num">
                          {money(r.netValueCents)}
                        </td>
                        <td data-label="% Círcula" className="revenue-num">
                          {r.circulaPercent != null ? `${r.circulaPercent}%` : '—'}
                        </td>
                        <td data-label="Círcula" className="revenue-num">
                          {money(r.circulaFeeCents)}
                        </td>
                        <td data-label="Você" className="revenue-num">
                          {money(r.netAmountCents)}
                        </td>
                        <td data-label="Status">
                          <span className={`revenue-badge ${badge.tone}`}>{badge.text}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {summary.pendingCount > 0 && (
            <p className="revenue-hint">
              "A repassar" = recebimentos no modelo ledger, ainda não transferidos automaticamente
              pela Asaas.
            </p>
          )}
        </>
      )}
    </section>
  )
}
