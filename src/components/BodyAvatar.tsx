import { useId } from 'react'
import { avatarGeometry } from '../lib/bodyAvatar'
import type { AvatarMeasures, AvatarView } from '../lib/bodyAvatar'

// Avatar corporal feminino em SVG. O desenho é calculado pelas medidas (ver
// lib/bodyAvatar.ts): não usa inteligência artificial nem imagem externa. Mostra
// chamadas (callouts) com as circunferências e, se houver uma avaliação
// anterior, o contorno dela tracejado por trás, para comparar a evolução.

export interface BodyAvatarProps {
  measures: AvatarMeasures
  view?: AvatarView
  /** Avaliação anterior, desenhada como contorno tracejado. */
  previous?: AvatarMeasures | null
  /** Mostra as chamadas com as circunferências. */
  callouts?: boolean
  className?: string
  title?: string
}

const KEYS_BY_VIEW: Record<AvatarView, string[]> = {
  front: ['neck', 'bust', 'waist', 'hip', 'thigh', 'calf'],
  back: ['waist', 'hip', 'thigh'],
  side: ['bust', 'waist', 'hip'],
}

export function BodyAvatar({ measures, view = 'front', previous = null, callouts = true, className, title }: BodyAvatarProps) {
  const uid = useId().replace(/:/g, '')
  const g = avatarGeometry(measures, view)
  const prev = previous ? avatarGeometry(previous, view) : null
  const skin = `ba-skin-${uid}`
  const shade = `ba-shade-${uid}`
  const shown = new Set(KEYS_BY_VIEW[view])
  const labelRight = g.width - 6

  return (
    <svg
      className={`body-avatar${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${g.width + 120} ${g.height}`}
      role="img"
      aria-label={title ?? 'Avatar do corpo'}
    >
      <defs>
        <linearGradient id={skin} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#e3b9a3" />
          <stop offset="0.28" stopColor="#f4d9c8" />
          <stop offset="0.5" stopColor="#fae6d8" />
          <stop offset="0.72" stopColor="#f2d4c1" />
          <stop offset="1" stopColor="#deb29a" />
        </linearGradient>
        <linearGradient id={shade} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#8a5a46" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {prev && (
        <g className="body-avatar-ghost" fill="none" stroke="#8a6a58" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.65">
          <path d={prev.body} />
          {prev.arms.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}

      <g className="body-avatar-figure" stroke="#b78672" strokeWidth="1.1" strokeLinejoin="round">
        {view !== 'side' && g.arms.map((d, i) => (
          <path key={i} d={d} fill={`url(#${skin})`} />
        ))}
        <path d={g.neck} fill={`url(#${skin})`} stroke="none" />
        <path d={g.body} fill={`url(#${skin})`} />
        <path d={g.body} fill={`url(#${shade})`} stroke="none" />
        {view === 'side' && g.arms.map((d, i) => (
          <path key={i} d={d} fill={`url(#${skin})`} />
        ))}
        <ellipse cx={g.head.cx} cy={g.head.cy} rx={g.head.rx} ry={g.head.ry} fill={`url(#${skin})`} />
        <path d={g.hair} fill="#7b5546" stroke="#6a4638" />
        <ellipse cx={g.head.cx} cy={g.head.cy - g.head.ry * 1.18} rx={g.head.rx * 0.42} ry={g.head.ry * 0.3} fill="#7b5546" stroke="#6a4638" />
      </g>

      {view === 'front' && (
        <g className="body-avatar-details" fill="none" stroke="#c59a86" strokeWidth="0.9" opacity="0.55" strokeLinecap="round">
          <path d={`M${g.cx - 22} ${g.top + 118} Q${g.cx - 10} ${g.top + 112} ${g.cx - 3} ${g.top + 116}`} />
          <path d={`M${g.cx + 22} ${g.top + 118} Q${g.cx + 10} ${g.top + 112} ${g.cx + 3} ${g.top + 116}`} />
          <ellipse cx={g.cx} cy={g.top + 600 * (1 - 0.575) + 4} rx="1.6" ry="2.4" />
        </g>
      )}

      {view === 'back' && (
        <path d={`M${g.cx} ${g.top + 110} L${g.cx} ${g.top + 330}`} stroke="#c59a86" strokeWidth="1" fill="none" opacity="0.7" />
      )}

      {callouts && (
        <g className="body-avatar-callouts" fontFamily="var(--font-label, system-ui)" fontSize="11">
          {g.stations
            .filter((st) => shown.has(st.key) && st.measured)
            .map((st) => {
              const x2 = labelRight + 8
              return (
                <g key={st.key}>
                  <line x1={g.cx - (st.edgeX - g.cx)} y1={st.y} x2={st.edgeX} y2={st.y} stroke="#c7584a" strokeWidth="1.2" opacity="0.55" strokeDasharray="3 3" />
                  <line x1={st.edgeX} y1={st.y} x2={x2} y2={st.y} stroke="#c7584a" strokeWidth="1" opacity="0.75" />
                  <circle cx={st.edgeX} cy={st.y} r="2.6" fill="#c7584a" />
                  <text x={x2 + 4} y={st.y - 3} fill="#5c4a3f" fontWeight="600">
                    {st.label}
                  </text>
                  <text x={x2 + 4} y={st.y + 10} fill="#8a6a58">
                    {st.valueCm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm
                  </text>
                </g>
              )
            })}
        </g>
      )}
    </svg>
  )
}
