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
  petals: number
}

// Posições espalhadas de forma estável (sem sorteio a cada tela): grade irregular.
const FLOWERS: Flower[] = Array.from({ length: 34 }, (_, i) => {
  const col = i % 3
  const row = Math.floor(i / 3)
  const jitterX = ((i * 37) % 23) / 23
  const jitterY = ((i * 53) % 19) / 19
  return {
    x: Math.min(94, col * 33 + jitterX * 24 + 2),
    y: Math.min(97, row * (100 / 11.5) + jitterY * 6),
    size: 30 + ((i * 29) % 43),
    dur: 10 + ((i * 7) % 6),
    delay: -((i * 3) % 11),
    spin: (i % 2 ? 1 : -1) * (10 + (i % 5) * 2),
    petals: i % 3 === 0 ? 5 : 6,
  }
})

function FlowerShape({ f }: { f: Flower }) {
  const step = 360 / f.petals
  return (
    <svg viewBox="-50 -50 100 100" width="100%" height="100%" focusable="false">
      {Array.from({ length: f.petals }, (_, i) => (
        <circle key={i} cx="0" cy="-23" r="17" fill="currentColor" transform={`rotate(${i * step})`} />
      ))}
      <circle r="10" fill="currentColor" opacity="0.55" />
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
