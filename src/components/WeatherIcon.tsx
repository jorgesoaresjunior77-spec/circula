import type { WeatherKind } from '../lib/weather'

// Ícones do tempo em SVG próprio (sem imagem externa), no traço fino do app.
// Movimento leve (sol girando, gotas caindo), parado com "reduzir movimento".

interface WeatherIconProps {
  kind: WeatherKind
  /** De noite, céu limpo e parcialmente nublado mostram a lua. */
  isDay?: boolean
  size?: number
  className?: string
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const CLOUD = 'M14 34h20a7 7 0 0 0 .8-13.950A10 10 0 0 0 15.500 22 6.500 6.500 0 0 0 14 34Z'

function Sun({ cx = 24, cy = 24, r = 7 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = cx + Math.cos(a) * (r + 4)
    const y1 = cy + Math.sin(a) * (r + 4)
    const x2 = cx + Math.cos(a) * (r + 8)
    const y2 = cy + Math.sin(a) * (r + 8)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
  })
  return (
    <g className="wx-sun">
      <g className="wx-sun-rays" {...stroke}>
        {rays}
      </g>
      <circle className="wx-sun-core" cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      <ellipse className="wx-gloss" cx={cx - r * 0.3} cy={cy - r * 0.35} rx={r * 0.34} ry={r * 0.2} transform={`rotate(-28 ${cx - r * 0.3} ${cy - r * 0.35})`} />
    </g>
  )
}

function Moon() {
  return <path className="wx-moon" d="M32 29A12 12 0 1 1 19 14a9 9 0 0 0 13 15Z" {...stroke} fill="currentColor" fillOpacity="0.18" />
}

function Cloud({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      <path className="wx-cloud" d={CLOUD} {...stroke} fill="currentColor" fillOpacity="0.14" />
      {/* reflexo de plástico: só aparece onde o CSS pede (botão do clima na Home) */}
      <path className="wx-gloss wx-gloss--line" d="M15.500 25.500c1-3.800 4.200-6.200 8-6.300" />
    </g>
  )
}

export function WeatherIcon({ kind, isDay = true, size = 40, className = '' }: WeatherIconProps) {
  let body: React.ReactNode
  switch (kind) {
    case 'clear':
      body = isDay ? <Sun /> : <Moon />
      break
    case 'partly':
      body = (
        <>
          {isDay ? <Sun cx={19} cy={17} r={5.500} /> : <g transform="translate(-6 -6) scale(0.8)"><Moon /></g>}
          <Cloud dy={4} />
        </>
      )
      break
    case 'cloudy':
      body = <Cloud />
      break
    case 'fog':
      body = (
        <>
          <Cloud dy={-5} />
          <g {...stroke}>
            <line x1="12" y1="38" x2="36" y2="38" />
            <line x1="16" y1="43" x2="32" y2="43" />
          </g>
        </>
      )
      break
    case 'drizzle':
    case 'rain':
      body = (
        <>
          <Cloud dy={-5} />
          <g className="wx-drops" {...stroke}>
            <line className="wx-drop wx-drop--1" x1="17" y1="36" x2="15" y2="41" />
            <line className="wx-drop wx-drop--2" x1="25" y1="36" x2="23" y2="41" />
            {kind === 'rain' && <line className="wx-drop wx-drop--3" x1="33" y1="36" x2="31" y2="41" />}
          </g>
        </>
      )
      break
    case 'storm':
      body = (
        <>
          <Cloud dy={-5} />
          <path className="wx-bolt" d="m25 31-5 8h5l-2 7 8-10h-5l2-5Z" {...stroke} fill="currentColor" fillOpacity="0.3" />
        </>
      )
      break
    case 'snow':
      body = (
        <>
          <Cloud dy={-5} />
          <g className="wx-drops" fill="currentColor">
            <circle className="wx-drop wx-drop--1" cx="17" cy="39" r="1.800" />
            <circle className="wx-drop wx-drop--2" cx="25" cy="41" r="1.800" />
            <circle className="wx-drop wx-drop--3" cx="33" cy="39" r="1.800" />
          </g>
        </>
      )
      break
  }
  return (
    <svg
      className={`wx-icon wx-icon--${kind} ${className}`.trim()}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  )
}
