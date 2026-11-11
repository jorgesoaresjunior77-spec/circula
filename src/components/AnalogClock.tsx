import { useEffect, useRef, useState } from 'react'
import { GARDEN_DEFAULT_TIMEZONE } from '../lib/timezone'
import { m as motion, useAnimationFrame, useMotionValue } from '../lib/motionKit'

// Relógio analógico da Home, em 3D: sem moldura nem fundo, mas com profundidade.
// As marcações, os ponteiros, o ponteiro dos segundos e o eixo ficam em camadas
// a alturas diferentes, com sombra projetada e bisel; o conjunto balança de leve
// e acompanha o dedo ou o mouse (parallax). Mostra a hora no fuso oficial do app
// (mesma regra do calendário). Com "reduzir movimento" ligado, o balanço e o
// ponteiro dos segundos somem e a hora é atualizada só a cada minuto.

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
  // Ponteiro dos segundos: ângulo contínuo, atualizado a cada quadro sem
  // re-renderizar o componente (0–360 dentro do minuto; a volta emenda sozinha).
  const sweep = useMotionValue(angles.second)
  useAnimationFrame(() => {
    if (reduced) return
    sweep.set(((Date.now() % 60_000) / 1000) * 6)
  })

  const label = `Agora são ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  // Inclina o relógio conforme o dedo/mouse sobre ele (parallax das camadas).
  const tiltRef = useRef<HTMLDivElement>(null)
  function onTilt(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return
    const box = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
    const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
    const el = tiltRef.current
    if (!el) return
    el.classList.add('is-tilting')
    el.style.setProperty('--rx', `${(-dy * 16).toFixed(1)}deg`)
    el.style.setProperty('--ry', `${(dx * 16).toFixed(1)}deg`)
  }
  function onTiltEnd() {
    const el = tiltRef.current
    if (!el) return
    el.classList.remove('is-tilting')
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
  }

  const ticks = Array.from({ length: 60 }, (_, i) => {
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
  })

  const layer = { viewBox: '0 0 100 100', 'aria-hidden': true, focusable: false } as const

  return (
    <div
      className="home-clock"
      role="img"
      aria-label={label}
      onPointerMove={onTilt}
      onPointerLeave={onTiltEnd}
      onPointerCancel={onTiltEnd}
    >
      <div className="home-clock-glass">
        <div className="home-clock-3d" ref={tiltRef}>
          {/* Camada 1 — marcações */}
          <svg {...layer} className="clock-layer clock-layer--face">
            {ticks}
          </svg>

          {/* Camada 2 — ponteiros das horas e dos minutos (cada um com bisel:
              corpo escuro por baixo e filete claro por cima) */}
          <svg {...layer} className="clock-layer clock-layer--hands">
            <g transform={`rotate(${angles.hour} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="28" className="home-clock-hand home-clock-hand--hour" />
              <line x1="49.4" y1="49" x2="49.4" y2="29" className="home-clock-hand home-clock-hand--hour home-clock-hand--lit" />
            </g>
            <g transform={`rotate(${angles.minute} 50 50)`}>
              <line x1="50" y1="54" x2="50" y2="17" className="home-clock-hand home-clock-hand--minute" />
              <line x1="49.6" y1="52" x2="49.6" y2="19" className="home-clock-hand home-clock-hand--minute home-clock-hand--lit" />
            </g>
          </svg>

          {/* Camada 3 — ponteiro dos segundos, mais alto que os outros */}
          {!reduced && (
            <div className="clock-layer clock-layer--second" aria-hidden="true">
              {/* O giro é contínuo (Motion, a cada quadro), sem "tique": o
                  ponteiro desliza. A sombra fica na camada de fora, parada. */}
              <motion.div className="clock-second-spin" style={{ rotate: sweep }}>
                <svg viewBox="0 0 100 100" focusable={false}>
                  <line x1="50" y1="60" x2="50" y2="13" className="home-clock-hand home-clock-hand--second" />
                  {/* contrapeso e ponta, como nos relógios de pulso */}
                  <circle cx="50" cy="60" r="2.1" className="home-clock-second-weight" />
                  <circle cx="50" cy="19" r="1.5" className="home-clock-second-tip" />
                </svg>
              </motion.div>
            </div>
          )}

          {/* Camada 4 — eixo, uma esfera com brilho */}
          <svg {...layer} className="clock-layer clock-layer--pin">
            <defs>
              <radialGradient id="home-clock-pin-grad" cx="35%" cy="30%" r="75%">
                <stop offset="0" stopColor="#c9a98f" />
                <stop offset="0.55" stopColor="#6b4a3a" />
                <stop offset="1" stopColor="#3a2a22" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="3.4" fill="url(#home-clock-pin-grad)" />
            <circle cx="48.9" cy="48.8" r="0.9" fill="rgba(255,255,255,0.75)" />
          </svg>
        </div>
      </div>
    </div>
  )
}
