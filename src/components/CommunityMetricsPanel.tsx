import { useState } from 'react'
import { useCommunityMetrics } from '../hooks/useCommunityMetrics'
import { useCommunityMoodOverview } from '../hooks/useCommunityMoodOverview'
import { useCommunityExtraMetrics } from '../hooks/useCommunityExtraMetrics'
import type { MetricsPeriodDays } from '../types/communityMetrics'
import { MOOD_META, MOOD_ORDER } from '../types/mood'

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
  const {
    overview: mood,
    loading: moodLoading,
    error: moodError,
  } = useCommunityMoodOverview(communityId, periodDays)
  const { metrics: extra, loading: extraLoading } = useCommunityExtraMetrics(communityId, periodDays)

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

          <p className="metrics-section-title">Áreas da comunidade</p>
          {extraLoading ? (
            <p className="metrics-hint">Carregando…</p>
          ) : (
            <div className="metrics-stats">
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.events_upcoming}</p>
                <p className="metric-tile-label">Próximos eventos</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.events_total_period}</p>
                <p className="metric-tile-label">Eventos criados</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.recipes_published}</p>
                <p className="metric-tile-label">Receitas publicadas</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.content_published}</p>
                <p className="metric-tile-label">Conteúdos publicados</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.challenge_completions_period}</p>
                <p className="metric-tile-label">Desafios concluídos</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.joy_moments_period}</p>
                <p className="metric-tile-label">Momentos de alegria</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.points_period}</p>
                <p className="metric-tile-label">Pontos no período</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">
                  {extra.help_open + extra.help_in_progress}
                </p>
                <p className="metric-tile-label">Ajuda pendente</p>
              </div>
              <div className="metric-tile">
                <p className="metric-tile-value">{extra.help_resolved}</p>
                <p className="metric-tile-label">Ajuda respondida</p>
              </div>
            </div>
          )}

          <p className="metrics-section-title">Como a comunidade está</p>
          <p className="metrics-hint">
            Registros de "Como você está hoje?" no período, somados por humor. Números agregados —
            sem identificar quem respondeu o quê.
          </p>

          {moodLoading && <p>Carregando humor da comunidade…</p>}
          {!moodLoading && moodError && <p className="auth-error">{moodError}</p>}
          {!moodLoading && !moodError && (
            <div className="metrics-stats mood-metrics">
              {MOOD_ORDER.map((m) => (
                <div key={m} className="metric-tile mood-metric-tile">
                  <p className="mood-metric-face" aria-hidden="true">
                    {MOOD_META[m].emoji}
                  </p>
                  <p className="metric-tile-value">{mood.byMood[m]}</p>
                  <p className="metric-tile-label">{MOOD_META[m].label}</p>
                </div>
              ))}
            </div>
          )}
          {!moodLoading && !moodError && mood.total === 0 && (
            <p className="metrics-hint">Nenhum registro de humor no período selecionado.</p>
          )}
        </>
      )}
    </div>
  )
}
