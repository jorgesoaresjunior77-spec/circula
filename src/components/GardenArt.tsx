import { useEffect, useId, useState } from 'react'
import { m } from '../lib/motionKit'
import { sunHeight, sunProgress, sunflowerTilt } from '../lib/sunPosition'

// Ilustrações do Meu Jardim, em 3D de verdade: cada flor é só a "cabeça" (sem
// caule), grande, montada em camadas a alturas diferentes — pétalas apagadas
// de vidro no fundo, pétalas acesas acima e o miolo, uma esfera, na frente.
// O conjunto gira no espaço (Motion), então as camadas se deslocam umas sobre
// as outras e a sombra no chão acompanha.
//
// - MonthFlower: flor do mês, uma pétala por dia; acende com o check do dia.
// - YearSunflower: girassol do ano, uma pétala por mês; ele fica virado para
//   onde o sol está naquela hora (esquerda de manhã, alto ao meio-dia, direita
//   à tarde) e um solzinho mostra a posição. De noite, descansa de frente.
//
// Tudo vetorial (SVG), nada gerado por IA. Com "reduzir movimento" ligado, as
// flores ficam paradas (regra do MotionRoot).

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
const GLASS = 'rgba(255, 255, 255, 0.6)'
const GLASS_STROKE = 'rgba(160, 140, 122, 0.5)'
const POP = { type: 'spring', stiffness: 380, damping: 16 } as const
const BOX = '0 0 300 300'

function useIds() {
  const base = useId()
  return { gloss: `${base}-gloss`, core: `${base}-core`, coreOff: `${base}-core-off`, gold: `${base}-gold`, seed: `${base}-seed` }
}

function Gloss({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
      <stop offset="0.55" stopColor="#fff" stopOpacity="0.12" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
  )
}

/** Uma camada da flor: um SVG inteiro, a uma certa altura (translateZ). */
function Layer({ z, children }: { z: number; children: React.ReactNode }) {
  return (
    <svg className="ga3d-layer" viewBox={BOX} style={{ transform: `translateZ(${z}px)` }} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Flor do mês
// ---------------------------------------------------------------------------
export function MonthFlower({ days, checked }: { days: number; checked: Set<number> }) {
  const ids = useIds()
  const done = checked.size
  const complete = done >= days && days > 0
  const step = 360 / Math.max(days, 1)
  const rx = Math.max(8, 235 / Math.max(days, 1))

  return (
    <div className="garden-art ga3d ga3d--flower" role="img" aria-label={`Flor do mês: ${done} de ${days} dias`}>
      <span className="ga3d-ground" aria-hidden="true" />
      {/* A flor gira devagar no espaço; as camadas dão a profundidade. */}
      <m.div
        className="ga3d-tilt"
        animate={{ rotateX: [10, -8], rotateY: [-16, 16] }}
        transition={{ duration: 5.5, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      >
        {/* fundo: todas as pétalas em vidro fosco */}
        <Layer z={0}>
          <defs>
            <Gloss id={ids.gloss} />
          </defs>
          <g transform="translate(150 150)">
            {Array.from({ length: days }, (_, i) => (
              <g key={i} transform={`rotate(${i * step})`}>
                <ellipse cx="0" cy="-90" rx={rx} ry="46" fill={GLASS} stroke={GLASS_STROKE} strokeWidth="1.2" />
                <ellipse cx="0" cy="-90" rx={rx} ry="46" fill={`url(#${ids.gloss})`} opacity="0.5" />
              </g>
            ))}
          </g>
        </Layer>

        {/* meio: as pétalas acesas, uma por dia marcado */}
        <Layer z={22}>
          <defs>
            <Gloss id={`${ids.gloss}-b`} />
          </defs>
          <g transform="translate(150 150)">
            {Array.from({ length: days }, (_, i) => {
              if (!checked.has(i + 1)) return null
              const color = PETAL_COLORS[i % PETAL_COLORS.length]
              return (
                <g key={i} transform={`rotate(${i * step})`}>
                  <m.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...POP, delay: Math.min(i * 0.018, 0.5) }}
                  >
                    <ellipse cx="0" cy="-90" rx={rx} ry="46" fill={color} stroke={OUTLINE} strokeWidth="1.6" />
                    <ellipse cx="0" cy="-90" rx={rx} ry="46" fill={`url(#${ids.gloss}-b)`} opacity="0.75" />
                    <ellipse cx={-rx * 0.28} cy="-112" rx={rx * 0.22} ry="11" fill="#fff" opacity="0.6" />
                  </m.g>
                </g>
              )
            })}
          </g>
        </Layer>

        {/* frente: o miolo, uma esfera; sorri quando o mês está completo */}
        <Layer z={48}>
          <defs>
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
          <g transform="translate(150 150)">
            <circle r="42" fill={`url(#${complete ? ids.core : ids.coreOff})`} stroke={OUTLINE} strokeWidth="2" />
            <ellipse cx="-13" cy="-17" rx="14" ry="8" fill="#fff" opacity="0.7" transform="rotate(-24 -13 -17)" />
            {complete && (
              <g fill="none" stroke="#7a4a1c" strokeWidth="3" strokeLinecap="round">
                <path d="M-16 -3 q4.500 -6 9 0" />
                <path d="M7 -3 q4.500 -6 9 0" />
                <path d="M-12 10 q12 12 24 0" />
              </g>
            )}
          </g>
        </Layer>
      </m.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Girassol do ano
// ---------------------------------------------------------------------------
const PETAL_PATH = 'M0 -50 C 22 -78 18 -122 0 -142 C -18 -122 -22 -78 0 -50 Z'

/** Sementes em espiral (filotaxia), como num girassol de verdade. */
const SEEDS = Array.from({ length: 64 }, (_, k) => {
  const r = 5.300 * Math.sqrt(k + 0.5)
  const a = (k * 137.500 * Math.PI) / 180
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 1.400 + (k % 3) * 0.250 }
})

function useSunProgress(): number | null {
  const [progress, setProgress] = useState(() => sunProgress())
  useEffect(() => {
    // O sol anda devagar: conferir a cada minuto basta.
    const id = window.setInterval(() => setProgress(sunProgress()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return progress
}

export function YearSunflower({ monthsDone }: { monthsDone: boolean[] }) {
  const ids = useIds()
  const count = monthsDone.filter(Boolean).length
  const progress = useSunProgress()
  const tilt = sunflowerTilt(progress)
  const sunLeft = progress === null ? 50 : 8 + 84 * progress
  const sunTop = progress === null ? 0 : 20 - 18 * sunHeight(progress)

  return (
    <div
      className="garden-art ga3d ga3d--sunflower"
      role="img"
      aria-label={`Girassol do ano: ${count} de 12 meses. ${progress === null ? 'É noite, ele descansa.' : 'Ele está virado para o sol.'}`}
    >
      {/* o sol no céu, na posição desta hora do dia */}
      {progress !== null && (
        <m.span
          className="ga3d-sun"
          aria-hidden="true"
          style={{ left: `${sunLeft}%`, top: `${sunTop}%` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          <svg viewBox="0 0 48 48" focusable="false">
            <g stroke="#f2b632" strokeWidth="3" strokeLinecap="round">
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i} x1="24" y1="3" x2="24" y2="9" transform={`rotate(${i * 45} 24 24)`} />
              ))}
            </g>
            <circle cx="24" cy="24" r="11" fill="#ffd95a" stroke="#e0a21c" strokeWidth="1.5" />
            <ellipse cx="20" cy="20" rx="4.500" ry="2.800" fill="#fff" opacity="0.75" transform="rotate(-24 20 20)" />
          </svg>
        </m.span>
      )}

      <span className="ga3d-ground" aria-hidden="true" />

      {/* O girassol encara o sol e balança um pouquinho em volta dessa direção. */}
      <m.div
        className="ga3d-tilt"
        animate={{
          rotateX: [tilt.rotateX - 3, tilt.rotateX + 3],
          rotateY: [tilt.rotateY - 4, tilt.rotateY + 4],
        }}
        transition={{ duration: 4.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      >
        {/* fundo: segunda fileira de pétalas, sempre clarinha */}
        <Layer z={0}>
          <g transform="translate(150 150) rotate(15) scale(0.94)">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={PETAL_PATH} transform={`rotate(${i * 30})`} fill="#f6e3a1" stroke="rgba(190, 150, 60, 0.45)" strokeWidth="1.2" opacity="0.85" />
            ))}
          </g>
        </Layer>

        {/* meio: uma pétala por mês — dourada quando o mês foi completado */}
        <Layer z={20}>
          <defs>
            <linearGradient id={ids.gold} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#f5a623" />
              <stop offset="0.6" stopColor="#ffd23f" />
              <stop offset="1" stopColor="#ffe98a" />
            </linearGradient>
            <Gloss id={ids.gloss} />
          </defs>
          <g transform="translate(150 150)">
            {monthsDone.map((lit, i) => (
              <g key={i} transform={`rotate(${i * 30})`}>
                {lit ? (
                  <m.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...POP, delay: i * 0.05 }}>
                    <path d={PETAL_PATH} fill={`url(#${ids.gold})`} stroke="rgba(150, 96, 20, 0.55)" strokeWidth="1.6" />
                    <path d="M-3 -62 C 6 -84 5 -112 -2 -130" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
                  </m.g>
                ) : (
                  <g>
                    <path d={PETAL_PATH} fill={GLASS} stroke={GLASS_STROKE} strokeWidth="1.2" />
                    <path d={PETAL_PATH} fill={`url(#${ids.gloss})`} opacity="0.45" />
                  </g>
                )}
              </g>
            ))}
          </g>
        </Layer>

        {/* frente: o miolo de sementes, abaulado e brilhante */}
        <Layer z={46}>
          <defs>
            <radialGradient id={ids.seed} cx="0.38" cy="0.32" r="0.8">
              <stop offset="0" stopColor="#a8703c" />
              <stop offset="0.55" stopColor="#70431f" />
              <stop offset="1" stopColor="#452710" />
            </radialGradient>
          </defs>
          <g transform="translate(150 150)">
            <circle r="52" fill={`url(#${ids.seed})`} stroke="rgba(52, 28, 10, 0.6)" strokeWidth="2" />
            {SEEDS.map((seed, k) => (
              <circle key={k} cx={seed.x} cy={seed.y} r={seed.s} fill={k % 2 ? '#e0b46a' : '#3a2010'} opacity="0.7" />
            ))}
            <ellipse cx="-17" cy="-22" rx="17" ry="9" fill="#fff" opacity="0.32" transform="rotate(-24 -17 -22)" />
          </g>
        </Layer>
      </m.div>
    </div>
  )
}

/** Nome antigo (a árvore do ano virou o girassol). */
export const YearTree = YearSunflower
