import { useId } from 'react'
import { m } from '../lib/motionKit'

// Ilustrações do Meu Jardim: flor do mês (uma pétala por dia) e árvore do
// ano (uma copa por mês). As pétalas só acendem com o check do dia.
//
// Estilo de desenho animado com cara de vidro em 3D: formas gordinhas com
// contorno macio, brilho de luz em cima e sombra no chão. O movimento é do
// Motion: a flor e a árvore balançam de leve, e cada pétala/copa "estoura"
// com mola quando acende. Tudo vetorial (SVG), nada gerado por IA. Com
// "reduzir movimento" ligado, fica tudo parado (regra do MotionRoot).

export const PETAL_COLORS = [
  '#e57373',
  '#f06292',
  '#ba68c8',
  '#9575cd',
  '#7986cb',
  '#64b5f6',
  '#4dd0e1',
  '#4db6ac',
  '#81c784',
  '#aed581',
  '#fff176',
  '#ffb74d',
  '#ff8a65',
  '#f48fb1',
  '#ce93d8',
  '#90caf9',
]

const OUTLINE = 'rgba(74, 52, 40, 0.42)'
const GLASS = 'rgba(255, 255, 255, 0.62)'
const GLASS_STROKE = 'rgba(160, 140, 122, 0.55)'

const POP = { type: 'spring', stiffness: 380, damping: 16 } as const
const swayOrigin = { originX: 0.5, originY: 1 } as const

function sway(deg: number, seconds: number) {
  return {
    animate: { rotate: [-deg, deg] },
    transition: { duration: seconds, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const },
  }
}

/** Sombra no chão, embaixo da planta. */
function Ground({ id }: { id: string }) {
  return <ellipse cx="150" cy="370" rx="78" ry="9" fill={`url(#${id})`} />
}

function SharedDefs({ ids }: { ids: { gloss: string; ground: string; stem: string; trunk: string; core: string; coreOff: string } }) {
  return (
    <defs>
      {/* Brilho de vidro: branco em cima, sumindo para baixo. */}
      <linearGradient id={ids.gloss} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.12" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={ids.ground} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#28201a" stopOpacity="0.34" />
        <stop offset="1" stopColor="#28201a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.stem} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9fd08f" />
        <stop offset="0.5" stopColor="#6fb064" />
        <stop offset="1" stopColor="#4c8a48" />
      </linearGradient>
      <linearGradient id={ids.trunk} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c49a78" />
        <stop offset="0.5" stopColor="#9a7252" />
        <stop offset="1" stopColor="#6f4f38" />
      </linearGradient>
      <radialGradient id={ids.core} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fff3b8" />
        <stop offset="0.5" stopColor="#f6c945" />
        <stop offset="1" stopColor="#d99a1e" />
      </radialGradient>
      <radialGradient id={ids.coreOff} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fbf6ec" />
        <stop offset="0.6" stopColor="#e3d6bf" />
        <stop offset="1" stopColor="#c9b89c" />
      </radialGradient>
    </defs>
  )
}

function useIds() {
  const base = useId()
  return {
    gloss: `${base}-gloss`,
    ground: `${base}-ground`,
    stem: `${base}-stem`,
    trunk: `${base}-trunk`,
    core: `${base}-core`,
    coreOff: `${base}-core-off`,
  }
}

/** Folha gordinha com brilho. */
function CartoonLeaf({ d, shine, gloss }: { d: string; shine: string; gloss: string }) {
  return (
    <m.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={POP}>
      <path d={d} fill="#7fc076" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      <path d={d} fill={`url(#${gloss})`} opacity="0.55" />
      <path d={shine} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />
    </m.g>
  )
}

export function MonthFlower({
  days,
  checked,
}: {
  days: number
  checked: Set<number>
}) {
  const ids = useIds()
  const done = checked.size
  const progress = days > 0 ? done / days : 0
  const complete = done >= days && days > 0
  const step = 360 / Math.max(days, 1)
  const rx = Math.max(7, 200 / Math.max(days, 1))
  // O broto cresce: as folhas aparecem com o progresso.
  const leaf1 = progress >= 0.25
  const leaf2 = progress >= 0.5
  const leaf3 = progress >= 0.75

  return (
    <svg viewBox="0 0 300 380" role="img" aria-label={`Flor do mês: ${done} de ${days} dias`} className="garden-art garden-art--flower">
      <SharedDefs ids={ids} />
      <Ground id={ids.ground} />

      {/* A planta inteira balança a partir da base. */}
      <m.g style={swayOrigin} {...sway(2.4, 3.6)}>
        {/* caule: corpo, contorno macio e filete de luz */}
        <path d="M150 368 C147 330 153 292 150 232" stroke={OUTLINE} strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M150 368 C147 330 153 292 150 232" stroke={`url(#${ids.stem})`} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M147 360 C145 326 150 292 147.500 240" stroke="#fff" strokeOpacity="0.45" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {leaf1 && (
          <CartoonLeaf d="M150 332 C112 326 94 302 90 284 C122 284 146 302 150 332Z" shine="M102 292 C116 296 132 306 142 320" gloss={ids.gloss} />
        )}
        {leaf2 && (
          <CartoonLeaf d="M150 310 C188 304 208 282 212 264 C180 264 156 282 150 310Z" shine="M200 272 C186 276 170 286 160 300" gloss={ids.gloss} />
        )}
        {leaf3 && (
          <CartoonLeaf d="M150 284 C126 278 114 262 112 250 C132 252 148 266 150 284Z" shine="M120 257 C128 260 138 268 144 276" gloss={ids.gloss} />
        )}

        {/* cabeça da flor */}
        <g transform="translate(150 140)">
          {Array.from({ length: days }, (_, i) => {
            const lit = checked.has(i + 1)
            const color = PETAL_COLORS[i % PETAL_COLORS.length]
            return (
              <g key={i} transform={`rotate(${i * step})`}>
                {lit ? (
                  // Pétala acesa: "estoura" com mola quando o dia é marcado.
                  <m.g
                    key="on"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...POP, delay: Math.min(i * 0.018, 0.5) }}
                  >
                    <ellipse cx="0" cy="-70" rx={rx} ry="36" fill={color} stroke={OUTLINE} strokeWidth="1.6" />
                    <ellipse cx="0" cy="-70" rx={rx} ry="36" fill={`url(#${ids.gloss})`} opacity="0.75" />
                    <ellipse cx={-rx * 0.28} cy="-88" rx={rx * 0.22} ry="9" fill="#fff" opacity="0.6" />
                  </m.g>
                ) : (
                  // Pétala apagada: vidro fosco, esperando o dia.
                  <g key="off">
                    <ellipse cx="0" cy="-70" rx={rx} ry="36" fill={GLASS} stroke={GLASS_STROKE} strokeWidth="1.2" />
                    <ellipse cx="0" cy="-70" rx={rx} ry="36" fill={`url(#${ids.gloss})`} opacity="0.5" />
                  </g>
                )}
              </g>
            )
          })}

          {/* miolo: uma esfera; sorri quando o mês está completo */}
          <m.g
            animate={complete ? { scale: [1, 1.07, 1] } : { scale: 1 }}
            transition={complete ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            <circle r="33" fill={`url(#${complete ? ids.core : ids.coreOff})`} stroke={OUTLINE} strokeWidth="2" />
            <ellipse cx="-10" cy="-13" rx="11" ry="6.500" fill="#fff" opacity="0.7" transform="rotate(-24 -10 -13)" />
            {complete && (
              <g fill="none" stroke="#7a4a1c" strokeWidth="2.4" strokeLinecap="round">
                <path d="M-12 -2 q3.500 -4.500 7 0" />
                <path d="M5 -2 q3.500 -4.500 7 0" />
                <path d="M-9 8 q9 9 18 0" />
              </g>
            )}
          </m.g>
        </g>
      </m.g>
    </svg>
  )
}

export function YearTree({ monthsDone }: { monthsDone: boolean[] }) {
  const ids = useIds()
  const count = monthsDone.filter(Boolean).length
  const trunkTop = 250 - count * 6
  const trunkD = `M150 368 C144 330 156 ${trunkTop + 40} 150 ${trunkTop}`

  return (
    <svg viewBox="0 0 300 380" role="img" aria-label={`Árvore do ano: ${count} de 12 meses`} className="garden-art garden-art--tree">
      <SharedDefs ids={ids} />
      <Ground id={ids.ground} />

      <m.g style={swayOrigin} {...sway(1.4, 4.4)}>
        {/* tronco: contorno, corpo e filete de luz */}
        <path d={trunkD} stroke={OUTLINE} strokeWidth={13 + count} fill="none" strokeLinecap="round" />
        <path d={trunkD} stroke={`url(#${ids.trunk})`} strokeWidth={9 + count} fill="none" strokeLinecap="round" />
        <path
          d={`M146 360 C141 328 152 ${trunkTop + 44} 146.500 ${trunkTop + 8}`}
          stroke="#fff"
          strokeOpacity="0.35"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* copas: uma bolha de vidro por mês */}
        <g transform={`translate(150 ${Math.max(105, trunkTop - 10)})`}>
          {monthsDone.map((lit, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2
            const r = 68
            const cx = Math.cos(a) * r
            const cy = Math.sin(a) * r * 0.85
            const color = PETAL_COLORS[(i * 3) % PETAL_COLORS.length]
            return lit ? (
              <m.g
                key={`${i}-on`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...POP, delay: i * 0.04 }}
              >
                <circle cx={cx} cy={cy} r="27" fill={color} stroke={OUTLINE} strokeWidth="1.8" />
                <circle cx={cx} cy={cy} r="27" fill={`url(#${ids.gloss})`} opacity="0.8" />
                <ellipse cx={cx - 9} cy={cy - 11} rx="8" ry="4.500" fill="#fff" opacity="0.65" transform={`rotate(-24 ${cx - 9} ${cy - 11})`} />
              </m.g>
            ) : (
              <g key={`${i}-off`}>
                <circle cx={cx} cy={cy} r="27" fill={GLASS} stroke={GLASS_STROKE} strokeWidth="1.2" />
                <circle cx={cx} cy={cy} r="27" fill={`url(#${ids.gloss})`} opacity="0.5" />
              </g>
            )
          })}
          <circle r="32" fill={`url(#${count === 12 ? ids.core : ids.coreOff})`} stroke={OUTLINE} strokeWidth="2" />
          <ellipse cx="-10" cy="-12" rx="11" ry="6.500" fill="#fff" opacity="0.7" transform="rotate(-24 -10 -12)" />
        </g>
      </m.g>
    </svg>
  )
}
