import { useId } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { RingsPlanIcon } from './PlanIcons'

// Capa do Casamento no Início: uma foto 16:9 cadastrada pela profissional, mostrada em 4 pedaços
// (retângulos de tamanhos diferentes, com espaço entre eles), sem moldura, com uma sombra leve embaixo dos de baixo.
// Desenhado em SVG: a foto continua inteira por trás e cada pedaço mostra a sua parte.

// Grade 160 x 90 (16:9), espaço de 3 entre os pedaços. O pedaço grande fica à direita (28/11/2026).
const PIECES = [
  { x: 98, y: 0, w: 62, h: 90 },
  { x: 0, y: 0, w: 95, h: 43.5 },
  { x: 40, y: 46.5, w: 55, h: 43.5 },
  { x: 0, y: 46.5, w: 37, h: 43.5 },
]
// Sem moldura: só uma sombra leve embaixo dos pedaços da fileira de baixo.
const BOTTOM_ROW = PIECES.filter((p) => p.y > 0 && p.y + p.h === 90)
const R = 6

export function HomeCasamentoBanner({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  const id = useId().replace(/:/g, '')
  return (
    <m.section className="home-cas" aria-label="Casamento" {...inViewOnce} variants={riseVariants}>
      <button type="button" className="home-cas-btn" onClick={onOpen} aria-label="Casamento: organize o seu casamento">
        <svg className="home-cas-svg" viewBox="-2 -2 164 98" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={`cas-${id}`}>
              {PIECES.map((p, i) => (
                <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={R} />
              ))}
            </clipPath>
            <linearGradient id={`casg-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f6e9dc" />
              <stop offset="1" stopColor="#dcc0a6" />
            </linearGradient>
            <filter id={`cass-${id}`} x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>
          {BOTTOM_ROW.map((p, i) => (
            <ellipse key={i} cx={p.x + p.w / 2} cy={p.y + p.h + 0.6} rx={p.w * 0.46} ry={2.2} fill="rgba(60,38,24,0.38)" filter={`url(#cass-${id})`} />
          ))}
          <g clipPath={`url(#cas-${id})`}>
            <rect x="0" y="0" width="160" height="90" fill={`url(#casg-${id})`} />
            {image && <image href={image} x="0" y="0" width="160" height="90" preserveAspectRatio="xMidYMid slice" />}
          </g>
        </svg>
        {!image && (
          <span className="home-cas-empty" aria-hidden="true">
            <RingsPlanIcon size={46} />
          </span>
        )}
      </button>
    </m.section>
  )
}
