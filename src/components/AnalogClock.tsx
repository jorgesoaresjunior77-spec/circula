import { useEffect, useState } from 'react'
import { GARDEN_DEFAULT_TIMEZONE } from '../lib/timezone'

// Relógio analógico da Home: sem moldura, sem fundo — só marcações finas e
// ponteiros sobre a tela. Mostra a hora no fuso oficial do app (mesma regra
// do calendário). Com "reduzir movimento" ligado, o ponteiro dos segundos
// some e a hora é atualizada só a cada minuto.

export function clockAngles(h: number, m: number, s: number) {
  return {
    hour: ((h % 12) + m / 60 + s / 3600) * 30,
    minute: (m + s / 60) * 6,
    second: s * 6,
  }
}

export function timeParts(at: Date, timeZone: string = GARDEN_DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { h: get('hour'), m: get('minute'), s: get('second') }
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function AnalogClock() {
  const [now, setNow] = useState(() => new Date())
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), reduced ? 30_000 : 1000)
    return () => window.clearInterval(id)
  }, [reduced])

  const { h, m, s } = timeParts(now)
  const angles = clockAngles(h, m, reduced ? 0 : s)
  const label = `Agora são ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  return (
    <div className="home-clock" role="img" aria-label={label}>
      <div className="home-clock-glass">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0
          return (
            <line
              key={i}
              x1="50"
              y1={major ? 6 : 8}
              x2="50"
              y2={major ? 13 : 11}
              className={major ? 'home-clock-tick home-clock-tick--major' : 'home-clock-tick'}
              transform={`rotate(${i * 6} 50 50)`}
            />
          )
        })}
        <line x1="50" y1="50" x2="50" y2="28" className="home-clock-hand home-clock-hand--hour" transform={`rotate(${angles.hour} 50 50)`} />
        <line x1="50" y1="54" x2="50" y2="17" className="home-clock-hand home-clock-hand--minute" transform={`rotate(${angles.minute} 50 50)`} />
        {!reduced && (
          <line x1="50" y1="56" x2="50" y2="14" className="home-clock-hand home-clock-hand--second" transform={`rotate(${angles.second} 50 50)`} />
        )}
        <circle cx="50" cy="50" r="2.4" className="home-clock-pin" />
      </svg>
      </div>
    </div>
  )
}
