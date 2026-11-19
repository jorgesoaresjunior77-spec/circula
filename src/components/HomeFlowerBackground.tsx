import type { CSSProperties } from 'react'

// Flores de pétalas bem redondas, espalhadas como fundo da Home, da revista até o
// fim da página. Só decoração: escondidas de leitores de tela, sem receber toque,
// paradas com "reduzir movimento".

interface Flower {
  x: number
  y: number
  size: number
  dur: number
  delay: number
  spin: number
  petal: string
  center: string
  petals: number
}

const FLOWERS: Flower[] = [
  { x: 6, y: 3, size: 92, dur: 11, delay: 0, spin: 14, petal: '#f4b9c8', center: '#f7e3a3', petals: 6 },
  { x: 80, y: 7, size: 70, dur: 13, delay: -4, spin: -12, petal: '#f6cfb6', center: '#f7e3a3', petals: 5 },
  { x: 38, y: 12, size: 52, dur: 12, delay: -8, spin: 10, petal: '#dccaf0', center: '#fbefc2', petals: 6 },
  { x: 90, y: 22, size: 84, dur: 10, delay: -2, spin: -14, petal: '#f4b9c8', center: '#f7e3a3', petals: 6 },
  { x: 14, y: 28, size: 66, dur: 12, delay: -6, spin: 12, petal: '#f9dfa9', center: '#f1b8a0', petals: 5 },
  { x: 58, y: 34, size: 96, dur: 14, delay: -3, spin: -10, petal: '#f6cfb6', center: '#f7e3a3', petals: 6 },
  { x: 4, y: 45, size: 76, dur: 11, delay: -9, spin: 16, petal: '#dccaf0', center: '#fbefc2', petals: 5 },
  { x: 84, y: 50, size: 60, dur: 13, delay: -5, spin: -12, petal: '#f4b9c8', center: '#f7e3a3', petals: 6 },
  { x: 40, y: 58, size: 72, dur: 10, delay: -1, spin: 12, petal: '#f9dfa9', center: '#f1b8a0', petals: 6 },
  { x: 10, y: 68, size: 88, dur: 12, delay: -7, spin: -14, petal: '#f6cfb6', center: '#f7e3a3', petals: 5 },
  { x: 76, y: 74, size: 80, dur: 11, delay: -4, spin: 10, petal: '#dccaf0', center: '#fbefc2', petals: 6 },
  { x: 46, y: 84, size: 62, dur: 13, delay: -2, spin: -10, petal: '#f4b9c8', center: '#f7e3a3', petals: 6 },
  { x: 6, y: 92, size: 74, dur: 10, delay: -6, spin: 14, petal: '#f9dfa9', center: '#f1b8a0', petals: 5 },
  { x: 86, y: 94, size: 68, dur: 12, delay: -8, spin: -12, petal: '#f6cfb6', center: '#f7e3a3', petals: 6 },
]

function FlowerShape({ f }: { f: Flower }) {
  const step = 360 / f.petals
  return (
    <svg viewBox="-50 -50 100 100" width="100%" height="100%" focusable="false">
      {Array.from({ length: f.petals }, (_, i) => (
        <circle key={i} cx="0" cy="-23" r="17" fill={f.petal} transform={`rotate(${i * step})`} />
      ))}
      <circle r="12" fill={f.center} />
    </svg>
  )
}

export function HomeFlowerBackground() {
  return (
    <div className="home-flowers" aria-hidden="true">
      {FLOWERS.map((f, i) => (
        <span
          key={i}
          className="home-flower"
          style={
            {
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: f.size,
              height: f.size,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
              '--spin': `${f.spin}deg`,
            } as CSSProperties
          }
        >
          <FlowerShape f={f} />
        </span>
      ))}
    </div>
  )
}
