import { useId } from 'react'
import { GARDEN_COLOR_HEX } from '../types/garden'

/**
 * Ilustração do Meu Jardim em 3 etapas (broto → florescendo → jardim em
 * flor), desenhada em SVG com a paleta do próprio app (GARDEN_COLOR_HEX).
 * Estilo aquarela botânica das referências da pasta identidadevisual/Meu
 * Jardim: pigmento mais denso nas bordas e claro no miolo (gradientes
 * radiais), folhas em duas metades com nervura, flores de pétala recortada
 * e halo de luz dourada. Sem filtros SVG (feTurbulence travava o navegador).
 * Tudo vetorial: nada gerado por IA, nada para baixar, nítido em qualquer
 * tamanho.
 */
export type GardenStage = 'seed' | 'bloom' | 'garden'

export const GARDEN_STAGE_LABEL: Record<GardenStage, string> = {
  seed: 'Broto',
  bloom: 'Florescendo',
  garden: 'Jardim em flor',
}

/** Etapa a partir do percentual (0–100) do desafio do mês. */
export function gardenStageForPercent(percent: number): GardenStage {
  if (percent >= 100) return 'garden'
  if (percent >= 34) return 'bloom'
  return 'seed'
}

const SAGE_DARK = '#6c7f61'
const ROSE = GARDEN_COLOR_HEX.rose
const PEACH = GARDEN_COLOR_HEX.peach
const LAVENDER = GARDEN_COLOR_HEX.lavender
const SAND = GARDEN_COLOR_HEX.sand
const GOLD = '#d9b56c'

type Ids = { leaf: string; leafLight: string; soil: string; glow: string; petal: Record<string, string> }

function Leaf({ x, y, len, angle, ids, light = false }: { x: number; y: number; len: number; angle: number; ids: Ids; light?: boolean }) {
  const w = len * 0.32
  const fill = `url(#${light ? ids.leafLight : ids.leaf})`
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M0 0 C ${len * 0.22} ${-w} ${len * 0.72} ${-w * 1.1} ${len} 0 C ${len * 0.72} ${w * 1.1} ${len * 0.22} ${w} 0 0 Z`}
        fill={fill}
        stroke={SAGE_DARK}
        strokeOpacity={0.35}
        strokeWidth={0.5}
      />
      {/* metade de baixo mais escura: dá o ar de folha dobrada */}
      <path
        d={`M0 0 C ${len * 0.22} ${w} ${len * 0.72} ${w * 1.1} ${len} 0 Z`}
        fill={SAGE_DARK}
        opacity={0.16}
      />
      <path d={`M${len * 0.06} 0 Q ${len * 0.5} ${-w * 0.12} ${len * 0.95} 0`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.6} strokeLinecap="round" />
      {[0.3, 0.52, 0.72].map((t) => (
        <g key={t} stroke="#fff" strokeOpacity={0.3} strokeWidth={0.4} strokeLinecap="round">
          <path d={`M${len * t} 0 L${len * (t + 0.12)} ${-w * 0.55}`} />
          <path d={`M${len * t} 0 L${len * (t + 0.12)} ${w * 0.55}`} />
        </g>
      ))}
    </g>
  )
}

/** Galho com folhas alternadas ao longo do caule. */
function Sprig({ x, y, angle, len, count, ids, curve = 0 }: { x: number; y: number; angle: number; len: number; count: number; ids: Ids; curve?: number }) {
  const leaves = Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 0.6)
    const px = len * t
    const py = curve * Math.sin(t * Math.PI) * -1
    const size = len * (0.3 - t * 0.12)
    return { px, py, size, i }
  })
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 Q ${len * 0.5} ${-curve * 1.2} ${len} 0`} fill="none" stroke={SAGE_DARK} strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />
      {leaves.map((l) => (
        <g key={l.i}>
          <Leaf x={l.px} y={l.py} len={l.size} angle={l.i % 2 === 0 ? -48 : 48} ids={ids} light={l.i % 2 === 1} />
        </g>
      ))}
      <Leaf x={len} y={0} len={len * 0.22} angle={-4} ids={ids} />
    </g>
  )
}

function Flower({ cx, cy, r, color, petalId, rot = 0, petals = 5 }: { cx: number; cy: number; r: number; color: string; petalId: string; rot?: number; petals?: number }) {
  const step = 360 / petals
  const petalPath = `M0 0 C ${-r * 0.62} ${-r * 0.2} ${-r * 0.7} ${-r * 0.86} ${-r * 0.2} ${-r * 1.02} L 0 ${-r * 0.88} L ${r * 0.2} ${-r * 1.02} C ${r * 0.7} ${-r * 0.86} ${r * 0.62} ${-r * 0.2} 0 0 Z`
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {Array.from({ length: petals }, (_, i) => (
        <g key={`b${i}`} transform={`rotate(${i * step + rot + step / 2}) scale(0.84)`} opacity={0.55}>
          <path d={petalPath} fill={color} />
        </g>
      ))}
      {Array.from({ length: petals }, (_, i) => (
        <g key={i} transform={`rotate(${i * step + rot})`}>
          <path d={petalPath} fill={`url(#${petalId})`} stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
          <path d={`M0 ${-r * 0.1} L0 ${-r * 0.74}`} stroke="#fff" strokeOpacity={0.45} strokeWidth={0.5} strokeLinecap="round" />
        </g>
      ))}
      <circle r={r * 0.2} fill={GOLD} />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        return (
          <g key={i}>
            <path d={`M0 0 L${Math.cos(a) * r * 0.34} ${Math.sin(a) * r * 0.34}`} stroke={GOLD} strokeWidth={0.5} opacity={0.9} />
            <circle cx={Math.cos(a) * r * 0.36} cy={Math.sin(a) * r * 0.36} r={r * 0.045} fill="#b98a3e" />
          </g>
        )
      })}
    </g>
  )
}

function Stem({ d, width = 2 }: { d: string; width?: number }) {
  return <path d={d} fill="none" stroke={SAGE_DARK} strokeWidth={width} strokeLinecap="round" opacity={0.88} />
}

function Bud({ x, y, color, petalId, ids }: { x: number; y: number; color: string; petalId: string; ids: Ids }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={3.6} ry={5} fill={`url(#${petalId})`} stroke={color} strokeOpacity={0.5} strokeWidth={0.5} transform={`rotate(14 ${x} ${y})`} />
      <Leaf x={x - 0.5} y={y + 4.5} len={6} angle={-130} ids={ids} />
      <Leaf x={x + 0.5} y={y + 4.5} len={6} angle={-50} ids={ids} light />
    </g>
  )
}

function Butterfly({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={0.92}>
      <ellipse cx={-3.6} cy={-1.4} rx={4.4} ry={2.8} fill={LAVENDER} transform="rotate(-26 -3.6 -1.4)" />
      <ellipse cx={3.6} cy={-1.4} rx={4.4} ry={2.8} fill={LAVENDER} transform="rotate(26 3.6 -1.4)" />
      <ellipse cx={-2.6} cy={2} rx={3} ry={2} fill={PEACH} transform="rotate(24 -2.6 2)" />
      <ellipse cx={2.6} cy={2} rx={3} ry={2} fill={PEACH} transform="rotate(-24 2.6 2)" />
      <ellipse cx={0} cy={0.4} rx={0.8} ry={3.6} fill={SAGE_DARK} />
    </g>
  )
}

interface GardenBloomProps {
  stage: GardenStage
  size?: number
  /** Texto para leitores de tela; sem ele a figura é decorativa. */
  label?: string
}

export function GardenBloom({ stage, size = 112, label }: GardenBloomProps) {
  const base = useId()
  const ids: Ids = {
    leaf: `${base}-leaf`,
    leafLight: `${base}-leaf-light`,
    soil: `${base}-soil`,
    glow: `${base}-glow`,
    petal: { rose: `${base}-p-rose`, peach: `${base}-p-peach`, lavender: `${base}-p-lav` },
  }
  const petalDefs: Array<[string, string]> = [
    [ids.petal.rose, ROSE],
    [ids.petal.peach, PEACH],
    [ids.petal.lavender, LAVENDER],
  ]

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`garden-bloom garden-bloom--${stage}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={ids.leaf} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a9b89c" />
          <stop offset="1" stopColor="#7d8f70" />
        </linearGradient>
        <linearGradient id={ids.leafLight} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c2cdb6" />
          <stop offset="1" stopColor="#97a98a" />
        </linearGradient>
        <linearGradient id={ids.soil} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d4be98" />
          <stop offset="1" stopColor="#a98a62" />
        </linearGradient>
        <radialGradient id={ids.glow} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#f3d9a8" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f3d9a8" stopOpacity={0} />
        </radialGradient>
        {petalDefs.map(([id, color]) => (
          <radialGradient key={id} id={id} cx="0.5" cy="0.95" r="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
            <stop offset="0.55" stopColor={color} stopOpacity={0.78} />
            <stop offset="1" stopColor={color} stopOpacity={1} />
          </radialGradient>
        ))}
      </defs>

      <circle cx={60} cy={stage === 'seed' ? 70 : 56} r={stage === 'garden' ? 56 : 46} fill={`url(#${ids.glow})`} />

      <ellipse cx={60} cy={104} rx={42} ry={5} fill={SAND} opacity={0.28} />
      <path d="M22 103 Q60 80 98 103 Z" fill={`url(#${ids.soil})`} />
      <path d="M34 98 Q60 84 86 98" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.2} strokeLinecap="round" />
      {[38, 52, 70, 82].map((px, i) => (
        <circle key={px} cx={px} cy={99.5 + (i % 2)} r={0.9} fill="#8f7352" opacity={0.5} />
      ))}

      <g>
        {stage === 'seed' && (
          <g>
            <path d="M52 100 q-2-6-6-8 M68 100 q2-6 6-9" fill="none" stroke={SAGE_DARK} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
            <Stem d="M60 94 C 59 84 61.5 76 60 66" width={2.3} />
            <Leaf x={60} y={68} len={27} angle={-155} ids={ids} />
            <Leaf x={60} y={66} len={25} angle={-25} ids={ids} light />
            <Leaf x={60.5} y={80} len={11} angle={-128} ids={ids} light />
            <Leaf x={59.5} y={78} len={11} angle={-52} ids={ids} />
            <circle cx={44} cy={59} r={1.8} fill="#fff" opacity={0.85} />
            <circle cx={44.5} cy={58.4} r={0.6} fill="#fff" />
            <path d="M82 52 l0 5 M79.5 54.5 l5 0" stroke="#e7c98a" strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
            <path d="M36 70 l0 3.4 M34.3 71.7 l3.4 0" stroke="#e7c98a" strokeWidth={0.8} strokeLinecap="round" opacity={0.8} />
          </g>
        )}

        {stage === 'bloom' && (
          <g>
            <Sprig x={58} y={98} angle={-124} len={30} count={4} ids={ids} curve={3} />
            <Sprig x={62} y={98} angle={-56} len={28} count={4} ids={ids} curve={-3} />
            <Stem d="M60 98 C 58 80 63 62 60 44" width={2.4} />
            <Leaf x={59} y={84} len={22} angle={-150} ids={ids} />
            <Leaf x={61} y={74} len={20} angle={-30} ids={ids} light />
            <Stem d="M61 80 C 70 74 78 68 84 58" width={1.6} />
            <Bud x={85} y={55} color={PEACH} petalId={ids.petal.peach} ids={ids} />
            <Flower cx={60} cy={34} r={22} color={ROSE} petalId={ids.petal.rose} rot={-8} petals={5} />
            <path d="M82 28 q3 3 1 7 q-4-1-1-7Z" fill={ROSE} opacity={0.65} />
            <path d="M34 54 q-3 2-2 6 q4 0 2-6Z" fill={ROSE} opacity={0.5} />
          </g>
        )}

        {stage === 'garden' && (
          <g>
            <path d="M24 102 q-3-12-9-17 M29 102 q0-10 3-15 M92 102 q3-11 10-16 M96 102 q-1-10-5-14 M60 103 q-6-8-12-9" fill="none" stroke={SAGE_DARK} strokeWidth={1.3} strokeLinecap="round" opacity={0.6} />
            <Sprig x={26} y={100} angle={-104} len={44} count={5} ids={ids} curve={4} />
            <Sprig x={94} y={100} angle={-76} len={44} count={5} ids={ids} curve={-4} />

            <Stem d="M38 98 C 38 86 33 74 32 62" />
            <Stem d="M60 98 C 59 76 61 56 60 38" width={2.4} />
            <Stem d="M84 98 C 84 86 90 72 91 58" />
            <Stem d="M50 98 C 48 88 46 80 44 72" width={1.5} />
            <Stem d="M72 98 C 74 88 76 78 78 70" width={1.5} />

            <Leaf x={37} y={86} len={17} angle={-150} ids={ids} />
            <Leaf x={38} y={78} len={15} angle={-34} ids={ids} light />
            <Leaf x={59} y={86} len={21} angle={-146} ids={ids} />
            <Leaf x={61} y={70} len={20} angle={-34} ids={ids} light />
            <Leaf x={84} y={86} len={17} angle={-34} ids={ids} />
            <Leaf x={85} y={76} len={15} angle={-148} ids={ids} light />

            <Flower cx={32} cy={55} r={14} color={LAVENDER} petalId={ids.petal.lavender} rot={20} petals={5} />
            <Flower cx={60} cy={30} r={20} color={ROSE} petalId={ids.petal.rose} rot={-8} petals={5} />
            <Flower cx={91} cy={50} r={15} color={PEACH} petalId={ids.petal.peach} rot={34} petals={5} />
            <Flower cx={44} cy={68} r={8} color={PEACH} petalId={ids.petal.peach} rot={10} petals={5} />
            <Flower cx={78} cy={66} r={8.5} color={ROSE} petalId={ids.petal.rose} rot={50} petals={5} />
            <Bud x={20} y={64} color={LAVENDER} petalId={ids.petal.lavender} ids={ids} />
            <Bud x={104} y={70} color={ROSE} petalId={ids.petal.rose} ids={ids} />

            <Butterfly x={100} y={26} s={1.1} rot={16} />
            <Butterfly x={16} y={36} s={0.8} rot={-14} />
          </g>
        )}
      </g>
    </svg>
  )
}
