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

/**
 * Aba "Métricas" do painel da Nutri. Somente leitura — 4 blocos agregados
 * (Membros, Engajamento, Áreas da comunidade, Como a comunidade está).
 *
 * Redesign editorial: classes .panel-metrics-*, sem .metric-tile/.metrics-*
 * (essas classes são compartilhadas com RevenuePanel e os painéis do
 * Master — não tocadas). Nenhuma lógica (useCommunityMetrics,
 * useCommunityMoodOverview, useCommunityExtraMetrics, periodDays) mudou —
 * só markup/classes.
 */
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
    <section className="panel-metrics">
      <header className="panel-metrics-head">
        <p className="panel-metrics-title">Painel · Métricas</p>
        <p className="panel-metrics-intro">
          Um retrato de como sua comunidade está — sempre um pouco atrás do tempo real, nunca ao
          vivo.
        </p>
      </header>

      {loading && <p className="panel-metrics-muted">Carregando métricas...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && metrics && (
        <>
          <div className="panel-metrics-block">
            <h3 className="panel-metrics-eyebrow">Membros</h3>

            <div className="panel-metrics-primary">
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{metrics.total_members}</span>
                <span className="panel-metrics-primary-label">Total de membros</span>
              </div>
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{metrics.active_members}</span>
                <span className="panel-metrics-primary-label">Ativas</span>
              </div>
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{metrics.inactive_members}</span>
                <span className="panel-metrics-primary-label">Inativas</span>
              </div>
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{metrics.new_members}</span>
                <span className="panel-metrics-primary-label">Novas</span>
              </div>
            </div>

            <p className="panel-metrics-hint">
              Ativa = pelo menos uma ação (post, comentário, reação, resposta de check-in, progresso
              de desafio ou entrada em círculo) nos últimos 30 dias, independente do período abaixo.
            </p>
          </div>

          <div className="panel-metrics-block">
            <div className="panel-metrics-block-head">
              <h3 className="panel-metrics-eyebrow">Engajamento</h3>
              <div className="panel-metrics-period">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`panel-metrics-period-button${
                      periodDays === option.value ? ' panel-metrics-period-button--active' : ''
                    }`}
                    onClick={() => setPeriodDays(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-metrics-grid">
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.posts_count}</span>
                <span className="panel-metrics-label">Posts</span>
              </div>
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.comments_count}</span>
                <span className="panel-metrics-label">Comentários</span>
              </div>
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.reactions_count}</span>
                <span className="panel-metrics-label">Reações</span>
              </div>
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.challenge_progress_count}</span>
                <span className="panel-metrics-label">Desafios</span>
              </div>
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.checkin_responses_count}</span>
                <span className="panel-metrics-label">Check-ins</span>
              </div>
              <div className="panel-metrics-item">
                <span className="panel-metrics-value">{metrics.circle_joins_count}</span>
                <span className="panel-metrics-label">Círculos</span>
              </div>
            </div>
          </div>

          <div className="panel-metrics-block">
            <h3 className="panel-metrics-eyebrow">Áreas da comunidade</h3>

            {extraLoading ? (
              <p className="panel-metrics-muted">Carregando…</p>
            ) : (
              <div className="panel-metrics-grid">
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.events_upcoming}</span>
                  <span className="panel-metrics-label">Próximos eventos</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.events_total_period}</span>
                  <span className="panel-metrics-label">Eventos criados</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.content_published}</span>
                  <span className="panel-metrics-label">Conteúdos publicados</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.challenge_completions_period}</span>
                  <span className="panel-metrics-label">Desafios concluídos</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.joy_moments_period}</span>
                  <span className="panel-metrics-label">Momentos de alegria</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.points_period}</span>
                  <span className="panel-metrics-label">Pontos no período</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">
                    {extra.help_open + extra.help_in_progress}
                  </span>
                  <span className="panel-metrics-label">Ajuda pendente</span>
                </div>
                <div className="panel-metrics-item">
                  <span className="panel-metrics-value">{extra.help_resolved}</span>
                  <span className="panel-metrics-label">Ajuda respondida</span>
                </div>
              </div>
            )}
          </div>

          <div className="panel-metrics-block">
            <h3 className="panel-metrics-eyebrow">Como a comunidade está</h3>
            <p className="panel-metrics-hint">
              Registros de "Como você está hoje?" no período, somados por humor. Números agregados —
              sem identificar quem respondeu o quê.
            </p>

            {moodLoading && <p className="panel-metrics-muted">Carregando humor da comunidade…</p>}
            {!moodLoading && moodError && <p className="auth-error">{moodError}</p>}
            {!moodLoading && !moodError && (
              <div className="panel-metrics-grid panel-metrics-mood-grid">
                {MOOD_ORDER.map((m) => (
                  <div key={m} className="panel-metrics-item panel-metrics-mood-item">
                    <span className="panel-metrics-mood-face" aria-hidden="true">
                      {MOOD_META[m].emoji}
                    </span>
                    <span className="panel-metrics-value">{mood.byMood[m]}</span>
                    <span className="panel-metrics-label">{MOOD_META[m].label}</span>
                  </div>
                ))}
              </div>
            )}
            {!moodLoading && !moodError && mood.total === 0 && (
              <p className="panel-metrics-hint">Nenhum registro de humor no período selecionado.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
