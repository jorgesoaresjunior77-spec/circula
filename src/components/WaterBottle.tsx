import { useEffect, useRef, useState } from 'react'

// Copo que se enche conforme a pessoa registra a água do dia. `progress` vai
// de 0 (vazio) a 1 (cheio). Quando o nível sobe, uma garrafinha aparece
// inclinada e despeja por um instante. SVG próprio, sem imagem externa.

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
      <g className="water-glass-pourer" aria-hidden="true">
        <g transform="translate(92 30) rotate(-118)">
          <path className="water-bottle-outline" d="M-9 -22 V-14 C-9 -14 -15 -10 -15 -2 V22 a4 4 0 0 0 4 4 H11 a4 4 0 0 0 4 -4 V-2 C15 -10 9 -14 9 -14 V-22 Z" fill="none" />
          <rect x="-13" y="2" width="26" height="22" rx="3" className="water-bottle-fill" />
        </g>
        <rect x="68" y="42" width="5" height={Math.max(4, y - 42)} rx="2.500" className="water-bottle-fill water-glass-stream" />
      </g>
      <g clipPath="url(#water-bottle-body)">
        <rect x="0" y="0" width="120" height="220" className="water-bottle-empty" />
        <rect x="0" y={y} width="120" height={height + 2} className="water-bottle-fill" />
      </g>
      <path className="water-bottle-outline" d={GLASS} fill="none" />
    </svg>
  )
}
