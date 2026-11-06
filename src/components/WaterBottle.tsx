// Garrafa que se enche conforme a pessoa registra a água do dia.
// `progress` vai de 0 (vazia) a 1 (cheia). SVG próprio, sem imagem externa.

interface WaterBottleProps {
  progress: number
  /** Dispara a comemoração discreta quando a meta é atingida. */
  celebrating?: boolean
}

// Corpo da garrafa no viewBox 0 0 120 220: do pescoço (y=40) ao fundo (y=206).
const BODY_TOP = 40
const BODY_BOTTOM = 206

export function WaterBottle({ progress, celebrating = false }: WaterBottleProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  const height = (BODY_BOTTOM - BODY_TOP) * clamped
  const y = BODY_BOTTOM - height
  const percent = Math.round(clamped * 100)

  return (
    <svg
      className={`water-bottle${celebrating ? ' water-bottle--celebrate' : ''}`}
      viewBox="0 0 120 220"
      role="img"
      aria-label={`Garrafa com ${percent}% da meta de água do dia`}
    >
      <defs>
        <clipPath id="water-bottle-body">
          <path d="M44 40 V24 h32 V40 C76 40 100 52 100 76 V196 a10 10 0 0 1 -10 10 H30 a10 10 0 0 1 -10 -10 V76 C20 52 44 40 44 40 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#water-bottle-body)">
        <rect x="0" y="0" width="120" height="220" className="water-bottle-empty" />
        <rect x="0" y={y} width="120" height={height + 2} className="water-bottle-fill" />
      </g>
      <path
        className="water-bottle-outline"
        d="M44 40 V24 h32 V40 C76 40 100 52 100 76 V196 a10 10 0 0 1 -10 10 H30 a10 10 0 0 1 -10 -10 V76 C20 52 44 40 44 40 Z"
        fill="none"
      />
      <rect x="46" y="12" width="28" height="12" rx="3" className="water-bottle-cap" />
    </svg>
  )
}
