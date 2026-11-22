import { useMemo } from 'react'
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
export function HomeFlowerGap({ seed = 1, count = 3, height = 44, sizes }: { seed?: number; count?: number; height?: number; sizes?: number[] }) {
  // Posições sorteadas a cada vez que a Home abre (poucas flores, em lugares diferentes).
  const flowers = useMemo(() => {
    const salt = seed + Math.floor(Math.random() * 997)
    if (sizes && sizes.length > 0) {
      // Quantidade e tamanhos fixos (ex.: duas flores, uma maior), cada uma na sua metade.
      return makeFlowers(salt, sizes.length).map((f, i) => ({
        ...f,
        size: sizes[i],
        x: i % 2 === 0 ? 8 + (f.x % 34) : 56 + (f.x % 34),
        y: 4 + (f.y % 18),
      }))
    }
    return makeFlowers(salt, 1 + Math.floor(Math.random() * count))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, count, sizes?.join(',')])
  // Redesign editorial: flores só pontuais (em poucas faixas); as demais viram só respiro.
  const showFlowers = seed === 2 || seed === 6
  if (!showFlowers) return <div className="home-flower-gap" aria-hidden="true" style={{ height: Math.min(height, 14) }} />
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
