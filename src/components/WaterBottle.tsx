import { useEffect, useRef, useState } from 'react'

// Copo que se enche conforme a pessoa registra a água do dia. `progress` vai
// de 0 (vazio) a 1 (cheio). Quando o nível sobe, a torneira ao lado
// abre por um instante. SVG próprio, sem imagem externa.

interface WaterBottleProps {
  progress: number
  /** Dispara a comemoração discreta quando a meta é atingida. */
  celebrating?: boolean
}

// Interior do copo no viewBox 0 0 120 220: da borda (y=70) ao fundo (y=204).
const BODY_TOP = 74
const BODY_BOTTOM = 204
const GLASS = 'M24 66 L33 200 a8 8 0 0 0 8 6 H79 a8 8 0 0 0 8 -6 L96 66 Z'

export function WaterBottle({ progress, celebrating = false }: WaterBottleProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  const height = (BODY_BOTTOM - BODY_TOP) * clamped
  const y = BODY_BOTTOM - height
  const percent = Math.round(clamped * 100)

  // Servindo: só quando o nível SOBE (não ao abrir a página).
  const previous = useRef(clamped)
  const [pouring, setPouring] = useState(false)
  useEffect(() => {
    const rose = clamped > previous.current + 0.001
    previous.current = clamped
    if (!rose) return
    setPouring(true)
    const timer = window.setTimeout(() => setPouring(false), 1400)
    return () => window.clearTimeout(timer)
  }, [clamped])

  return (
    <svg
      className={`water-bottle water-glass${celebrating ? ' water-bottle--celebrate' : ''}${pouring ? ' water-glass--pouring' : ''}`}
      viewBox="0 0 120 220"
      role="img"
      aria-label={`Copo com ${percent}% da meta de água do dia`}
    >
      <defs>
        <clipPath id="water-bottle-body">
          <path d={GLASS} />
        </clipPath>
      </defs>
      {/* torneira: coluna, arco e bico sobre o copo (sempre à vista) */}
      <g className="water-tap" aria-hidden="true">
        <path d="M108 206 V34 a24 24 0 0 0 -48 0 V44" fill="none" className="water-tap-pipe" />
        <rect x="54" y="42" width="12" height="6" rx="2" className="water-tap-tip" />
        <rect x="100" y="196" width="16" height="10" rx="3" className="water-tap-tip" />
      </g>
      <g className="water-glass-pourer" aria-hidden="true">
        <rect x="57.500" y="48" width="5" height={Math.max(4, y - 48)} rx="2.500" className="water-bottle-fill water-glass-stream" />
      </g>
      <g clipPath="url(#water-bottle-body)">
        <rect x="0" y="0" width="120" height="220" className="water-bottle-empty" />
        <rect x="0" y={y} width="120" height={height + 2} className="water-bottle-fill" />
      </g>
      <path className="water-bottle-outline" d={GLASS} fill="none" />
    </svg>
  )
}
