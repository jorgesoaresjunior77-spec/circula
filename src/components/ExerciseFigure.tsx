import { POSES, LEN, VIEW, solvePose } from '../lib/exercisePoses'
import type { Pt } from '../lib/exercisePoses'

// Desenho de uma pose de exercício (corpo de lado), em traço suave nas cores do
// Círcula. A perna e o braço de trás ficam mais claros.

const SKIN = '#c98f6a'
const SKIN_FAR = '#e4c3a8'
const LINE = '#8a5a3c'
const PROP = '#b9a590'

function limb(points: Pt[], color: string, w: number) {
  return <polyline points={points.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
}

export function ExerciseFigure({ pose, label }: { pose: string; label?: string }) {
  const def = POSES[pose]
  if (!def) return null
  const s = solvePose(def)
  const arch = def.arch ?? 0
  // coluna: curva suave entre quadril e ombro
  const mid: Pt = [(s.hip[0] + s.shoulder[0]) / 2, (s.hip[1] + s.shoulder[1]) / 2]
  const ang = Math.atan2(s.shoulder[1] - s.hip[1], s.shoulder[0] - s.hip[0])
  const ctrl: Pt = [mid[0] + Math.sin(ang) * arch * 1.0, mid[1] - Math.cos(ang) * arch * 1.0]

  // enquadra o corpo inteiro (deitado ou em prancha é mais comprido que em pé)
  const bw = s.box.x1 - s.box.x0
  const W = Math.max(VIEW.w, bw + 24)
  const H = (W * VIEW.h) / VIEW.w
  const vx = (s.box.x0 + s.box.x1) / 2 - W / 2
  const vy = VIEW.floor + 8 - H
  return (
    <svg viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}`} role="img" aria-label={label ?? 'Posição do exercício'} className="exfig">
      <line x1={vx + 8} x2={vx + W - 8} y1={VIEW.floor} y2={VIEW.floor} stroke="#d9c8b6" strokeWidth="1.5" strokeLinecap="round" />
      {s.prop?.type === 'wall' && <rect x={s.prop.x} y="6" width="5" height={VIEW.floor - 6} rx="1.5" fill={PROP} opacity="0.55" />}
      {s.prop?.type === 'chair' && (
        <g stroke={PROP} strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1={s.prop.x - 14} x2={s.prop.x + 8} y1={s.prop.y} y2={s.prop.y} />
          <line x1={s.prop.x - 14} x2={s.prop.x - 14} y1={s.prop.y - 24} y2={VIEW.floor} />
          <line x1={s.prop.x + 8} x2={s.prop.x + 8} y1={s.prop.y} y2={VIEW.floor} />
        </g>
      )}
      {limb(s.legs.far.slice(0, 4), SKIN_FAR, 6.5)}
      {limb(s.arms.far, SKIN_FAR, 5.5)}
      <path d={`M${s.hip[0]},${s.hip[1]} Q${ctrl[0]},${ctrl[1]} ${s.shoulder[0]},${s.shoulder[1]}`} fill="none" stroke={LINE} strokeWidth="9" strokeLinecap="round" opacity="0.95" />
      {limb(s.legs.near, SKIN, 7)}
      {limb(s.arms.near, SKIN, 6)}
      <circle cx={s.head[0]} cy={s.head[1]} r={LEN.head} fill="#f1d8c3" stroke={LINE} strokeWidth="1.5" />
    </svg>
  )
}
