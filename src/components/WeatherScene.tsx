import type { CSSProperties } from 'react'
import type { WeatherKind } from '../lib/weather'

// Cena animada da Previsão, no estilo do vídeo de referência: nuvens fofas
// que flutuam devagar, chuva ou neve caindo de cada nuvem, sol com brilho,
// lua com estrelas e, na tempestade, relâmpagos. Tudo em CSS (nada de
// imagem gerada), só decoração: escondida de leitores de tela, sem receber
// toque, parada quando a pessoa pede "reduzir movimento".

interface CloudSpec {
  x: number // % da largura
  y: number // % da altura
  s: number // escala
  dur: number // segundos da deriva
  delay: number
  precip?: 'rain' | 'drizzle' | 'snow'
}

type Tone = 'light' | 'grey' | 'dark'

/** Número pseudoaleatório estável (mesma cena sempre desenha igual). */
function rnd(seed: number): number {
  const v = Math.sin(seed * 9301 + 49297) * 233280
  return v - Math.floor(v)
}

function layout(kind: WeatherKind): { tone: Tone; clouds: CloudSpec[] } {
  const precip = kind === 'drizzle' ? 'drizzle' : kind === 'rain' || kind === 'storm' ? 'rain' : kind === 'snow' ? 'snow' : undefined
  const count = kind === 'partly' ? 3 : kind === 'cloudy' ? 6 : kind === 'fog' ? 3 : kind === 'clear' ? 0 : 6
  const tone: Tone = kind === 'storm' ? 'dark' : kind === 'rain' || kind === 'drizzle' || kind === 'cloudy' ? 'grey' : 'light'
  const slots: [number, number, number][] = [
    [6, 8, 1.15],
    [58, 4, 0.9],
    [30, 22, 1.3],
    [74, 26, 0.8],
    [8, 34, 0.85],
    [48, 40, 1.0],
  ]
  const clouds: CloudSpec[] = slots.slice(0, count).map(([x, y, s], i) => ({
    x,
    y,
    s,
    dur: 7 + rnd(i + 3) * 6,
    delay: -rnd(i + 11) * 8,
    precip,
  }))
  return { tone, clouds }
}

function Drops({ kind, seed }: { kind: 'rain' | 'drizzle' | 'snow'; seed: number }) {
  const n = kind === 'drizzle' ? 6 : kind === 'snow' ? 8 : 11
  return (
    <span className={`wx3-drops wx3-drops--${kind}`}>
      {Array.from({ length: n }, (_, i) => (
        <s
          key={i}
          style={
            {
              left: `${6 + rnd(seed * 17 + i) * 86}%`,
              animationDelay: `${-rnd(seed * 31 + i) * 1.6}s`,
              animationDuration: `${(kind === 'snow' ? 3 : kind === 'drizzle' ? 1.3 : 0.8) + rnd(seed * 7 + i) * 0.5}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}

function Cloud({ spec, tone, seed }: { spec: CloudSpec; tone: Tone; seed: number }) {
  return (
    <span
      className={`wx3-cloud wx3-cloud--${tone}`}
      style={
        {
          left: `${spec.x}%`,
          top: `${spec.y}%`,
          '--s': spec.s,
          animationDuration: `${spec.dur}s`,
          animationDelay: `${spec.delay}s`,
        } as CSSProperties
      }
    >
      <i className="wx3-puff wx3-puff--a" />
      <i className="wx3-puff wx3-puff--b" />
      <i className="wx3-puff wx3-puff--c" />
      <i className="wx3-puff wx3-puff--base" />
      {spec.precip && <Drops kind={spec.precip} seed={seed} />}
    </span>
  )
}

export function WeatherScene({ kind, isDay }: { kind: WeatherKind; isDay: boolean }) {
  const { tone, clouds } = layout(kind)
  const showSun = isDay && (kind === 'clear' || kind === 'partly')
  const showMoon = !isDay && (kind === 'clear' || kind === 'partly')
  const showStars = !isDay && (kind === 'clear' || kind === 'partly' || kind === 'cloudy')
  return (
    <div className={`wx3-scene wx3-scene--${kind}${isDay ? '' : ' wx3-scene--night'}`} aria-hidden="true">
      {showStars &&
        Array.from({ length: 16 }, (_, i) => (
          <u
            key={i}
            className="wx3-star"
            style={
              {
                left: `${rnd(i + 1) * 96 + 2}%`,
                top: `${rnd(i + 40) * 55 + 3}%`,
                animationDelay: `${-rnd(i + 70) * 4}s`,
              } as CSSProperties
            }
          />
        ))}
      {showSun && (
        <span className="wx3-sun">
          <span className="wx3-sun-rays" />
          <span className="wx3-sun-core" />
        </span>
      )}
      {showMoon && <span className="wx3-moon" />}
      {kind === 'fog' && (
        <>
          <span className="wx3-haze wx3-haze--1" />
          <span className="wx3-haze wx3-haze--2" />
          <span className="wx3-haze wx3-haze--3" />
        </>
      )}
      {clouds.map((c, i) => (
        <Cloud key={i} spec={c} tone={tone} seed={i + 1} />
      ))}
      {kind === 'storm' && <span className="wx3-flash" />}
    </div>
  )
}
