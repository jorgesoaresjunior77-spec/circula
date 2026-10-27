import { useId } from 'react'
import { formatGardenJourneySummary } from '../types/garden'
import type { GardenJourneyStats } from '../types/garden'

interface GardenJourneyRingProps {
  /** Camada 1 — desafio atual: dias concluídos / total de dias dele. */
  current: {
    completed: number
    total: number
    colorOne?: string | null
    colorTwo?: string | null
  }
  /** Camada 2 — jornada acumulada no Círcula (ver computeGardenJourneyStats). */
  journey: GardenJourneyStats
  /** Diâmetro em px do anel externo (o interno é proporcionalmente menor). */
  size?: number
}

/** Cada dia concluído = 1% do anel externo, até um teto visual de 100 dias — uma ESCALA, não uma meta inventada. O rótulo central nunca mostra esse percentual (só o número real), exatamente para não parecer "70% de uma conquista" que não existe. */
const JOURNEY_RING_DAY_CAP = 100

/**
 * Roda em camadas (Etapa N) — anel externo (jornada acumulada, mais
 * fino/suave) + anel interno (desafio atual, igual ao GardenProgressWheel
 * original em proporção e comportamento). Um componente NOVO, separado de
 * GardenProgressWheel — que continua existindo sozinho para o snapshot do
 * Feed e para "Meu histórico", onde só a camada 1 faz sentido (um desafio
 * arquivado não tem "progresso atual").
 *
 * Nunca exibe um percentual para o anel externo — só a contagem real
 * ("X dias · Y desafios concluídos"), porque não existe uma "meta" de
 * verdade para a jornada acumulada (ver doc de GardenJourneyInput sobre a
 * limitação de dados). O preenchimento visual usa uma escala declarada
 * (1 dia = 1%, até 100 dias), não uma meta fictícia.
 */
export function GardenJourneyRing({ current, journey, size = 108 }: GardenJourneyRingProps) {
  const gradientId = useId()

  const safeCurrentTotal = Number.isFinite(current.total) && current.total > 0 ? current.total : 0
  const safeCurrentCompleted = Number.isFinite(current.completed) ? Math.max(0, current.completed) : 0
  const currentPercent =
    safeCurrentTotal > 0
      ? Math.max(0, Math.min(100, Math.round((Math.min(safeCurrentCompleted, safeCurrentTotal) / safeCurrentTotal) * 100)))
      : 0

  const journeyDays = Math.max(0, journey.totalDaysCompleted)
  const journeyPercent = Math.max(0, Math.min(100, Math.round((Math.min(journeyDays, JOURNEY_RING_DAY_CAP) / JOURNEY_RING_DAY_CAP) * 100)))
  const hasJourney = journeyDays > 0 || journey.challengesFinished > 0

  const currentStopOne = current.colorOne ?? 'var(--ink-action)'
  const currentStopTwo = current.colorTwo ?? currentStopOne

  const outerRadius = 46
  const innerRadius = 32
  const outerCircumference = 2 * Math.PI * outerRadius
  const innerCircumference = 2 * Math.PI * innerRadius
  const outerOffset = outerCircumference * (1 - journeyPercent / 100)
  const innerOffset = innerCircumference * (1 - currentPercent / 100)

  const journeyLabel = formatGardenJourneySummary(journey)

  return (
    <div
      className="garden-journey-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Desafio atual: ${currentPercent}%, ${safeCurrentCompleted} de ${safeCurrentTotal} dias concluídos. ${journeyLabel}.`}
    >
      <svg viewBox="0 0 100 100" className="garden-journey-ring-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-current`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={currentStopOne} />
            <stop offset="100%" stopColor={currentStopTwo} />
          </linearGradient>
        </defs>

        {/* Anel externo — jornada acumulada. Tom suave (champagne), sempre presente mesmo vazio (só o traço de fundo), para nunca parecer "quebrado". */}
        <circle className="garden-journey-ring-outer-track" cx="50" cy="50" r={outerRadius} />
        {hasJourney && (
          <circle
            className="garden-journey-ring-outer-fill"
            cx="50"
            cy="50"
            r={outerRadius}
            strokeDasharray={outerCircumference}
            strokeDashoffset={outerOffset}
          />
        )}

        {/* Anel interno — desafio atual, mesma lógica do GardenProgressWheel. */}
        <circle className="garden-journey-ring-inner-track" cx="50" cy="50" r={innerRadius} />
        <circle
          className="garden-journey-ring-inner-fill"
          cx="50"
          cy="50"
          r={innerRadius}
          stroke={`url(#${gradientId}-current)`}
          strokeDasharray={innerCircumference}
          strokeDashoffset={innerOffset}
        />
      </svg>

      <span className="garden-journey-ring-center" aria-hidden="true">
        <strong>{currentPercent}</strong>
        <small>%</small>
      </span>
    </div>
  )
}
