import { useProfessionalDashboard } from '../hooks/useProfessionalDashboard'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { formatEventDate } from '../lib/formatEventDate'

interface ProfessionalDashboardProps {
  communityId: string
  /** Pular para outra aba do painel a partir dos blocos. */
  onOpenTab: (tab: string) => void
}

/**
 * Home do painel Professional. Mostra o que importa logo na entrada —
 * participantes, novas, ajuda pendente, desafios ativos, pontos,
 * receitas recentes, próximos eventos, publicações recentes e métricas
 * resumidas. Tudo com dados reais (RPCs community_metrics /
 * points_community_summary + consultas que a RLS já libera para a dona).
 */
export function ProfessionalDashboard({ communityId, onOpenTab }: ProfessionalDashboardProps) {
  const { data, loading, error } = useProfessionalDashboard(communityId, 30)

  if (loading) return <p className="home-muted">Carregando o painel...</p>
  if (error) return <p className="auth-error">Não foi possível carregar o painel agora.</p>

  const kpis: { label: string; value: number | string; tab: string }[] = [
    { label: 'Participantes ativas', value: data.members_active, tab: 'participantes' },
    { label: 'Novas (30 dias)', value: data.members_new, tab: 'participantes' },
    { label: 'Ajuda pendente', value: data.help_pending, tab: 'ajuda' },
    { label: 'Desafios ativos', value: data.challenges_active, tab: 'desafios' },
    { label: 'Pontos (30 dias)', value: data.points_period, tab: 'pontos' },
    { label: 'Publicações', value: data.posts_count, tab: 'publicacoes' },
  ]

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-kpis">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            className="metric-tile panel-dashboard-kpi"
            onClick={() => onOpenTab(kpi.tab)}
          >
            <p className="metric-tile-value">{kpi.value}</p>
            <p className="metric-tile-label">{kpi.label}</p>
          </button>
        ))}
      </div>

      <div className="panel-dashboard-grid">
        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Pedidos de ajuda</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('ajuda')}>
              Abrir
            </button>
          </div>
          <p className="panel-dashboard-line">
            {data.help_pending === 0
              ? 'Nenhum pedido pendente. 🌿'
              : `${data.help_pending} pedido(s) aguardando resposta.`}
          </p>
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Próximos eventos</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('eventos')}>
              Abrir
            </button>
          </div>
          {data.upcoming_events.length === 0 ? (
            <p className="panel-dashboard-line">Nenhum evento agendado.</p>
          ) : (
            <ul className="panel-dashboard-list">
              {data.upcoming_events.map((event) => (
                <li key={event.id}>
                  <span>{event.title}</span>
                  <span className="panel-dashboard-muted">{formatEventDate(event.starts_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Receitas recentes</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('receitas')}>
              Abrir
            </button>
          </div>
          {data.recent_recipes.length === 0 ? (
            <p className="panel-dashboard-line">Nenhuma receita publicada ainda.</p>
          ) : (
            <ul className="panel-dashboard-list">
              {data.recent_recipes.map((recipe) => (
                <li key={recipe.id}>
                  <span>{recipe.title ?? 'Receita'}</span>
                  <span className="panel-dashboard-muted">
                    {formatRelativeTime(recipe.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Publicações recentes</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('publicacoes')}>
              Abrir
            </button>
          </div>
          {data.recent_posts.length === 0 ? (
            <p className="panel-dashboard-line">Nenhuma publicação recente.</p>
          ) : (
            <ul className="panel-dashboard-list">
              {data.recent_posts.map((post) => (
                <li key={post.id}>
                  <span className="panel-dashboard-clip">
                    {post.author_name ? `${post.author_name}: ` : ''}
                    {post.content}
                  </span>
                  <span className="panel-dashboard-muted">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Pontos</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('pontos')}>
              Abrir
            </button>
          </div>
          <p className="panel-dashboard-line">
            {data.points_period} pontos concedidos nos últimos 30 dias ({data.points_all_time} no
            total).
          </p>
          {data.top_earners.length > 0 && (
            <ul className="panel-dashboard-list">
              {data.top_earners.map((earner) => (
                <li key={earner.profile_id}>
                  <span>{earner.full_name ?? 'Participante'}</span>
                  <span className="panel-dashboard-muted">{earner.balance} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Engajamento (30 dias)</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('metricas')}>
              Ver métricas
            </button>
          </div>
          <ul className="panel-dashboard-list">
            <li>
              <span>Publicações</span>
              <span className="panel-dashboard-muted">{data.posts_count}</span>
            </li>
            <li>
              <span>Comentários</span>
              <span className="panel-dashboard-muted">{data.comments_count}</span>
            </li>
            <li>
              <span>Reações</span>
              <span className="panel-dashboard-muted">{data.reactions_count}</span>
            </li>
            <li>
              <span>Participantes inativas</span>
              <span className="panel-dashboard-muted">{data.members_inactive}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
