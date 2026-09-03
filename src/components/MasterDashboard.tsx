import type { PlatformOverview } from '../types/platform'

interface MasterDashboardProps {
  overview: PlatformOverview | null
  loading: boolean
  error: string | null
}

interface Tile {
  label: string
  value: number | string
  hint?: string
}

interface Section {
  title: string
  tiles: Tile[]
}

/**
 * Visão Geral do Painel Master — KPIs agregados da plataforma inteira.
 * Nenhum dado individual: só contagens, somas e proporções. Cards
 * brancos, números grandes e legíveis, agrupados por seção.
 */
export function MasterDashboard({ overview, loading, error }: MasterDashboardProps) {
  if (loading) return <p className="home-muted">Carregando a visão da plataforma...</p>
  if (error || !overview) {
    return <p className="auth-error">Não foi possível carregar a visão da plataforma agora.</p>
  }

  const o = overview
  const sections: Section[] = [
    {
      title: 'Comunidades',
      tiles: [
        { label: 'Total', value: o.communities_total },
        { label: 'Ativas', value: o.communities_active, hint: 'com assinatura vigente' },
        { label: 'Novas (30d)', value: o.communities_new_30d },
        { label: 'Com receitas', value: o.communities_with_recipes },
      ],
    },
    {
      title: 'Pessoas',
      tiles: [
        { label: 'Profissionais', value: o.professionals_total },
        { label: 'Profissionais ativas', value: o.professionals_active },
        { label: 'Membros', value: o.members_total },
        { label: 'Membros novos (30d)', value: o.members_new_30d },
        { label: 'Usuárias (total)', value: o.users_total },
        { label: 'Novas (7d)', value: o.users_new_7d },
        { label: 'Novas (30d)', value: o.users_new_30d },
      ],
    },
    {
      title: 'Conteúdo',
      tiles: [
        { label: 'Publicações', value: o.posts_total, hint: `${o.posts_30d} nos últimos 30d` },
        { label: 'Receitas publicadas', value: o.recipes_published },
        { label: 'Conteúdos publicados', value: o.content_published },
        { label: 'Eventos', value: o.events_total, hint: `${o.events_upcoming} próximos` },
      ],
    },
    {
      title: 'Engajamento',
      tiles: [
        { label: 'Desafios', value: o.challenges_total, hint: `${o.challenges_active} ativos` },
        {
          label: 'Conclusões de desafio',
          value: o.challenge_completions_total,
          hint: `${o.challenge_completions_30d} nos 30d`,
        },
        { label: 'Dias de desafio marcados', value: o.challenge_days_done_total },
        { label: 'Respostas de check-in', value: o.checkin_responses_total },
        {
          label: 'Momentos de alegria',
          value: o.joy_moments_total,
          hint: `${o.joy_moments_30d} nos 30d`,
        },
      ],
    },
    {
      title: 'Pontos (agregado)',
      tiles: [
        { label: 'Distribuídos (total)', value: o.points_distributed_total },
        { label: 'Distribuídos (30d)', value: o.points_distributed_30d },
      ],
    },
    {
      title: 'Pedidos de ajuda (contagem)',
      tiles: [
        { label: 'Abertos', value: o.help_open },
        { label: 'Em andamento', value: o.help_in_progress },
        { label: 'Respondidos', value: o.help_resolved },
      ],
    },
  ]

  return (
    <div className="master-dashboard">
      {sections.map((section) => (
        <section key={section.title} className="master-section">
          <p className="metrics-section-title">{section.title}</p>
          <div className="metrics-stats">
            {section.tiles.map((tile) => (
              <div key={tile.label} className="metric-tile">
                <p className="metric-tile-value">{tile.value}</p>
                <p className="metric-tile-label">{tile.label}</p>
                {tile.hint && <p className="master-tile-hint">{tile.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="master-generated">
        Atualizado em {new Date(o.generated_at).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
