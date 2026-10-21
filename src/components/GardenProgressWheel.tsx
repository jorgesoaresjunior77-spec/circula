import { useId } from 'react'

interface GardenProgressWheelProps {
  /** Atividades concluídas. Nunca negativo na prática (ver chamadores), mas clampado aqui mesmo assim. */
  completed: number
  /** Total de atividades do desafio (dias realmente gerados, não um valor decorativo). */
  total: number
  /** Cores pessoais (hex) — mesma fonte usada no compartilhamento (snapshot) ou no perfil (ao vivo). `null`/ausente cai no acento padrão do app. */
  colorOne?: string | null
  colorTwo?: string | null
  /** Diâmetro em px. */
  size?: number
}

/**
 * Roda de progresso do desafio ATUAL (camada 1 da especificação — as
 * camadas de progresso acumulado e conquistas de longo prazo não fazem
 * parte deste componente). Recebe `completed`/`total` já resolvidos
 * pelo chamador — não sabe nem precisa saber se são dados ao vivo
 * (GardenMemberView) ou um snapshot congelado (GardenShareCard): só
 * números explícitos, nunca os dois misturados pelo próprio
 * componente.
 */
export function GardenProgressWheel({
  completed,
  total,
  colorOne,
  colorTwo,
  size = 88,
}: GardenProgressWheelProps) {
  const gradientId = useId()

  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
  const safeCompleted = Number.isFinite(completed) ? Math.max(0, completed) : 0
  const rawPercent = safeTotal > 0 ? (Math.min(safeCompleted, safeTotal) / safeTotal) * 100 : 0
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)))

  const stopOne = colorOne ?? 'var(--ink-action)'
  const stopTwo = colorTwo ?? stopOne

  const radius = 42
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - percent / 100)

  return (
    <div
      className="garden-wheel"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        safeTotal > 0
          ? `Progresso do desafio: ${percent}%, ${safeCompleted} de ${safeTotal} dias concluídos`
          : 'Progresso do desafio indisponível'
      }
    >
      <svg viewBox="0 0 100 100" className="garden-wheel-svg" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stopOne} />
            <stop offset="100%" stopColor={stopTwo} />
          </linearGradient>
        </defs>
        <circle className="garden-wheel-track" cx="50" cy="50" r={radius} />
        <circle
          className="garden-wheel-fill"
          cx="50"
          cy="50"
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="garden-wheel-center" aria-hidden="true">
        <strong>{percent}</strong>
        <small>%</small>
      </span>
    </div>
  )
}
