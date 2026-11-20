import type { CSSProperties } from 'react'

// Flores de pétalas redondas, só decoração: ficam nos ESPAÇOS entre os blocos da
// Home (nunca atrás de banners ou cards, onde ninguém as veria). Escondidas de
// leitores de tela, sem receber toque e paradas com "reduzir movimento".

interface Flower {
  x: number
  y: number
  size: number
  dur: number
  delay: number
  spin: number
  petals: number
}

function makeFlowers(seed: number, count: number): Flower[] {
  return Array.from({ length: count }, (_, i) => {
    const k = i + seed * 7
    return {
      x: 4 + ((k * 37) % 86),
      y: 8 + ((k * 53) % 70),
      size: 26 + ((k * 29) % 36),
      dur: 9 + ((k * 7) % 6),
      delay: -((k * 3) % 11),
      spin: (k % 2 ? 1 : -1) * (10 + (k % 5) * 2),
      petals: k % 3 === 0 ? 5 : 6,
    }
  })
}

function FlowerShape({ petals }: { petals: number }) {
  const step = 360 / petals
  return (
    <svg viewBox="-50 -50 100 100" width="100%" height="100%" focusable="false">
      {Array.from({ length: petals }, (_, i) => (
        <circle key={i} cx="0" cy="-23" r="17" fill="currentColor" transform={`rotate(${i * step})`} />
      ))}
      <circle r="10" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

/** Uma faixa de espaço com algumas flores flutuando. Use entre os blocos da Home. */
export function HomeFlowerGap({ seed = 1, count = 5, height = 76 }: { seed?: number; count?: number; height?: number }) {
  const flowers = makeFlowers(seed, count)
  return (
    <div className="home-flower-gap" aria-hidden="true" style={{ height }}>
      {flowers.map((f, i) => (
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
          <FlowerShape petals={f.petals} />
        </span>
      ))}
    </div>
  )
}
