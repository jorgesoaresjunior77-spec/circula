import { useState } from 'react'
import { useCommunityMetrics } from '../hooks/useCommunityMetrics'
import { useCommunityExtraMetrics } from '../hooks/useCommunityExtraMetrics'
import { useViewTotals } from '../hooks/useViewTotals'
import type { MetricsPeriodDays } from '../types/communityMetrics'
import { TRACKED_SCREENS, screenId } from '../lib/screens'
import { share } from '../lib/communityInsights'
import { EngagementRanking, ViewsOverview } from './EngagementInsights'
import { CommunityInsights } from './CommunityInsights'

interface CommunityMetricsPanelProps {
  communityId: string
}

const PERIOD_OPTIONS: { label: string; value: MetricsPeriodDays }[] = [
  { label: 'Hoje', value: 1 },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
]

/** Barras horizontais simples: um nome, uma barra proporcional e o número. */
function HBars({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.every((r) => r.value === 0)) return <p className="panel-metrics-muted">{empty}</p>
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label} className="hbars-row">
          <span className="hbars-label">{r.label}</span>
          <span className="hbars-track" aria-hidden="true">
            <span className="hbars-fill" style={{ width: Math.max(r.value > 0 ? 3 : 0, (r.value / max) * 100) + '%' }} />
          </span>
          <strong className="hbars-num">{r.value}</strong>
        </li>
      ))}
    </ul>
  )
}

function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

/** Quantas vezes cada área do app foi aberta pelas participantes. */
function AreaUsage({ communityId }: { communityId: string }) {
  const totals = useViewTotals(communityId)
  const rows = TRACKED_SCREENS.map((s) => {
    const row = totals['screen:' + screenId(s.key)]
    return { label: s.label, value: row?.views ?? 0, viewers: row?.viewers ?? 0 }
  })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="panel-metrics-block">
      <h3 className="panel-metrics-eyebrow">Áreas mais usadas</h3>
      <p className="panel-metrics-hint">
        Quantas vezes cada área do app foi aberta pelas participantes (uma abertura por pessoa a cada visita ao app). A sua
        navegação não entra na conta.
      </p>
      <HBars rows={rows} empty="Ainda não há aberturas registradas. Os números começam a aparecer a partir de agora." />
    </div>
  )
}

/**
 * Aba "Métricas" do painel da Nutri. Somente leitura, em ordem simples:
 * resumo, engajamento, crescimento, visualizações, áreas mais usadas,
 * conteúdos e ranking. Cada conteúdo também mostra o próprio contador, ao
 * vivo, quando aberto pela profissional.
 */
export function CommunityMetricsPanel({ communityId }: CommunityMetricsPanelProps) {
  const [periodDays, setPeriodDays] = useState<MetricsPeriodDays>(30)
  const { metrics, loading, error } = useCommunityMetrics(communityId, periodDays)
  const { metrics: extra, loading: extraLoading } = useCommunityExtraMetrics(communityId, periodDays)

  const interactions = metrics
    ? metrics.posts_count + metrics.comments_count + metrics.reactions_count + metrics.checkin_responses_count
    : 0

  return (
    <section className="panel-metrics">
      <header className="panel-metrics-head">
        <p className="panel-metrics-title">Painel · Métricas</p>
        <p className="panel-metrics-intro">
          Tudo o que acontece na sua comunidade, em números simples. Os conteúdos também mostram a contagem de cada um, na
          própria página, quando você os abre.
        </p>
      </header>

      {loading && <p className="panel-metrics-muted">Carregando métricas...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && metrics && (
        <>
          <div className="panel-metrics-block">
            <div className="panel-metrics-block-head">
              <h3 className="panel-metrics-eyebrow">Resumo</h3>
              <div className="panel-metrics-period" role="group" aria-label="Período">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={'panel-metrics-period-button' + (periodDays === option.value ? ' panel-metrics-period-button--active' : '')}
                    onClick={() => setPeriodDays(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="kpi-grid">
              <Kpi value={metrics.total_members} label="Participantes" />
              <Kpi
                value={metrics.active_members}
                label="Ativas"
                hint={share(metrics.active_members, metrics.total_members) + '% das participantes'}
              />
              <Kpi value={metrics.new_members} label="Novas no período" />
              <Kpi value={interactions} label="Interações no período" />
            </div>
            <p className="panel-metrics-hint">
              Ativa = pelo menos uma ação (post, comentário, reação, check-in ou entrada em círculo) nos últimos 30 dias.
            </p>
          </div>

          <div className="panel-metrics-block">
            <h3 className="panel-metrics-eyebrow">Engajamento no período</h3>
            <HBars
              empty="Nenhuma atividade no período escolhido."
              rows={[
                { label: 'Publicações', value: metrics.posts_count },
                { label: 'Comentários', value: metrics.comments_count },
                { label: 'Reações', value: metrics.reactions_count },
                { label: 'Check-ins', value: metrics.checkin_responses_count },
                { label: 'Entradas em círculos', value: metrics.circle_joins_count },
              ]}
            />
          </div>

          <div className="panel-metrics-block">
            <h3 className="panel-metrics-eyebrow">Eventos e conteúdos</h3>
            {extraLoading ? (
              <p className="panel-metrics-muted">Carregando…</p>
            ) : (
              <div className="kpi-grid">
                <Kpi value={extra.events_upcoming} label="Próximos eventos" />
                <Kpi value={extra.events_total_period} label="Eventos criados no período" />
                <Kpi value={extra.content_published} label="Conteúdos publicados" />
                <Kpi value={extra.joy_moments_period} label="Momentos de alegria" />
              </div>
            )}
          </div>
        </>
      )}

      <CommunityInsights communityId={communityId} />
      <AreaUsage communityId={communityId} />
      <ViewsOverview communityId={communityId} />
      <EngagementRanking communityId={communityId} />
    </section>
  )
}
