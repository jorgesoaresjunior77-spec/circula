import { useId } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { RingsPlanIcon } from './PlanIcons'

// Capa do Casamento no Início: uma foto 16:9 cadastrada pela profissional, mostrada em 4 pedaços
// (retângulos de tamanhos diferentes, com espaço entre eles), cada um com a moldura dos outros cards.
// Desenhado em SVG: a foto continua inteira por trás e cada pedaço mostra a sua parte.

// Grade 160 x 90 (16:9), espaço de 3 entre os pedaços.
const PIECES = [
  { x: 0, y: 0, w: 62, h: 90 },
  { x: 65, y: 0, w: 95, h: 43.5 },
  { x: 65, y: 46.5, w: 55, h: 43.5 },
  { x: 123, y: 46.5, w: 37, h: 43.5 },
]
const R = 6

export function HomeCasamentoBanner({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  const id = useId().replace(/:/g, '')
  return (
    <m.section className="home-cas" aria-label="Casamento" {...inViewOnce} variants={riseVariants}>
      <button type="button" className="home-cas-btn" onClick={onOpen} aria-label="Casamento: organize o seu casamento">
        <svg className="home-cas-svg" viewBox="-2 -2 164 94" aria-hidden="true" focusable="false">
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
          </defs>
          <g clipPath={`url(#cas-${id})`}>
            <rect x="0" y="0" width="160" height="90" fill={`url(#casg-${id})`} />
            {image && <image href={image} x="0" y="0" width="160" height="90" preserveAspectRatio="xMidYMid slice" />}
          </g>
          {/* moldura de cada pedaço: filete creme e contorno marrom, como os outros cards */}
          {PIECES.map((p, i) => (
            <g key={i}>
              <rect x={p.x - 0.9} y={p.y - 0.9} width={p.w + 1.8} height={p.h + 1.8} rx={R + 0.9} fill="none" stroke="rgba(243,232,219,0.85)" strokeWidth="1.8" />
              <rect x={p.x - 1.9} y={p.y - 1.9} width={p.w + 3.8} height={p.h + 3.8} rx={R + 1.9} fill="none" stroke="rgba(125,100,79,0.45)" strokeWidth="0.45" />
            </g>
          ))}
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
