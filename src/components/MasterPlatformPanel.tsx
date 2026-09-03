import type { PlatformOverview } from '../types/platform'

interface MasterPlatformPanelProps {
  overview: PlatformOverview | null
  loading: boolean
  error: string | null
}

const STATUS_LABEL: Record<string, string> = {
  trial: 'Em teste',
  active: 'Ativas',
  past_due: 'Pagamento pendente',
  canceled: 'Canceladas',
  blocked: 'Bloqueadas',
}

const CYCLE_LABEL: Record<string, string> = {
  monthly: 'mensal',
  yearly: 'anual',
  weekly: 'semanal',
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Aba "Plataforma" do Painel Master — assinaturas por status, trials a
 * expirar, catálogo de planos e regra de split. Dados de negócio da
 * plataforma (billing), nunca conteúdo de comunidade nem dado individual
 * de usuária. Vem do mesmo `platform_overview` (uma chamada só).
 */
export function MasterPlatformPanel({ overview, loading, error }: MasterPlatformPanelProps) {
  if (loading) return <p className="home-muted">Carregando dados da plataforma...</p>
  if (error || !overview) {
    return <p className="auth-error">Não foi possível carregar os dados da plataforma agora.</p>
  }

  const o = overview

  const renderStatusList = (byStatus: Record<string, number>) => {
    const entries = Object.entries(byStatus)
    if (entries.length === 0) return <p className="master-tile-hint">Nenhuma assinatura.</p>
    return (
      <ul className="panel-dashboard-list">
        {entries.map(([status, n]) => (
          <li key={status}>
            <span>{STATUS_LABEL[status] ?? status}</span>
            <span className="panel-dashboard-muted">{n}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="master-dashboard">
      <section className="master-section">
        <p className="metrics-section-title">Assinaturas da plataforma (profissionais)</p>
        {renderStatusList(o.platform_subs_by_status)}
      </section>

      <section className="master-section">
        <p className="metrics-section-title">Assinaturas de comunidade</p>
        {renderStatusList(o.community_subs_by_status)}
      </section>

      <section className="master-section">
        <p className="metrics-section-title">Trials</p>
        <div className="metrics-stats">
          <div className="metric-tile">
            <p className="metric-tile-value">{o.trials_ending_7d}</p>
            <p className="metric-tile-label">Trials terminando em 7 dias</p>
          </div>
        </div>
      </section>

      <section className="master-section">
        <p className="metrics-section-title">Split de receita</p>
        <div className="metrics-stats">
          <div className="metric-tile">
            <p className="metric-tile-value">
              {o.split_professional_percent != null ? `${o.split_professional_percent}%` : '—'}
            </p>
            <p className="metric-tile-label">Profissional</p>
          </div>
          <div className="metric-tile">
            <p className="metric-tile-value">
              {o.split_circula_percent != null ? `${o.split_circula_percent}%` : '—'}
            </p>
            <p className="metric-tile-label">Círcula</p>
          </div>
        </div>
      </section>

      <section className="master-section">
        <p className="metrics-section-title">Planos</p>
        {o.plans.length === 0 ? (
          <p className="master-tile-hint">Nenhum plano cadastrado.</p>
        ) : (
          <ul className="panel-dashboard-list">
            {o.plans.map((plan) => (
              <li key={plan.id}>
                <span>
                  {plan.name} <span className="panel-dashboard-muted">({plan.subject})</span>
                  {!plan.is_active && ' — inativo'}
                </span>
                <span className="panel-dashboard-muted">
                  {brl(plan.price_cents)} / {CYCLE_LABEL[plan.billing_cycle] ?? plan.billing_cycle}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
