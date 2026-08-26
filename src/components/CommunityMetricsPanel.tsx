import { useState } from 'react'
import { useCommunityMetrics } from '../hooks/useCommunityMetrics'
import type { MetricsPeriodDays } from '../types/communityMetrics'

interface CommunityMetricsPanelProps {
  communityId: string
}

const PERIOD_OPTIONS: { label: string; value: MetricsPeriodDays }[] = [
  { label: 'Hoje', value: 1 },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
]

export function CommunityMetricsPanel({ communityId }: CommunityMetricsPanelProps) {
  const [periodDays, setPeriodDays] = useState<MetricsPeriodDays>(30)
  const { metrics, loading, error } = useCommunityMetrics(communityId, periodDays)

  return (
    <div className="metrics-panel">
      {loading && <p>Carregando métricas...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && metrics && (
        <>
          <div className="metrics-stats">
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.total_members}</p>
              <p className="metric-tile-label">Total de Members</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.active_members}</p>
              <p className="metric-tile-label">Ativas</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.inactive_members}</p>
              <p className="metric-tile-label">Inativas</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.new_members}</p>
              <p className="metric-tile-label">Novas</p>
            </div>
          </div>

          <p className="metrics-hint">
            Ativa = pelo menos uma ação (post, comentário, reação, resposta de check-in, progresso
            de desafio ou entrada em círculo) nos últimos 30 dias, independente do período abaixo.
          </p>

          <p className="metrics-section-title">Engajamento</p>

          <div className="metrics-period">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`metrics-period-button${
                  periodDays === option.value ? ' metrics-period-button--active' : ''
                }`}
                onClick={() => setPeriodDays(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="metrics-stats">
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.posts_count}</p>
              <p className="metric-tile-label">Posts</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.comments_count}</p>
              <p className="metric-tile-label">Comentários</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.reactions_count}</p>
              <p className="metric-tile-label">Reações</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.challenge_progress_count}</p>
              <p className="metric-tile-label">Desafios</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.checkin_responses_count}</p>
              <p className="metric-tile-label">Check-ins</p>
            </div>
            <div className="metric-tile">
              <p className="metric-tile-value">{metrics.circle_joins_count}</p>
              <p className="metric-tile-label">Círculos</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
