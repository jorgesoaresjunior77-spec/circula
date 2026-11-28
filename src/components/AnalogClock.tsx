import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { GARDEN_DEFAULT_TIMEZONE } from '../lib/timezone'
import { webglDisponivel } from '../lib/scene3d'
import { formatClockDate } from '../lib/clockDate'
import { m as motion, useAnimationFrame, useMotionValue } from '../lib/motionKit'
import { useClockStyle } from '../lib/clockStyle'
import { RoseDigitalFace, SwissFace } from './ClockFaces'

// Relógio analógico da Home, em 3D: sem moldura nem fundo, mas com profundidade.
// As marcações, os ponteiros, o ponteiro dos segundos e o eixo ficam em camadas
// a alturas diferentes, com sombra projetada e bisel; o conjunto balança de leve
// e acompanha o dedo ou o mouse (parallax). Mostra a hora no fuso oficial do app
// (mesma regra do calendário). Com "reduzir movimento" ligado, o balanço e o
// ponteiro dos segundos somem e a hora é atualizada só a cada minuto.

const Clock3D = lazy(() => import('./Clock3D'))

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
  const [failed, setFailed] = useState(() => !webglDisponivel())
  // Modelo escolhido em "Relógio do mundo": clássico (3D), rosé digital ou suíço.
  const [clockStyle] = useClockStyle()

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

  const label = `Agora são ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}, ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`

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

  const layer = { viewBox: '0 0 100 100', 'aria-hidden': true, focusable: false } as const

  // Reserva em camadas de SVG: aparece enquanto o 3D carrega e se o aparelho não tiver WebGL.
  const flat = (
    <>
      {/* Camada 1 — caixa quadrada de cantos arredondados (formato Apple Watch) e tela escura, sem marcações */}
          <svg {...layer} className="clock-layer clock-layer--face">
            <defs>
              <linearGradient id="home-clock-case-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e7cdb8" />
                <stop offset="0.5" stopColor="#b98f74" />
                <stop offset="1" stopColor="#8a6450" />
              </linearGradient>
            </defs>
            <rect x="96" y="30" width="5" height="12" rx="2.5" fill="url(#home-clock-case-grad)" />
            <rect x="5" y="2" width="91" height="96" rx="25" fill="url(#home-clock-case-grad)" />
            <rect x="11" y="8" width="79" height="84" rx="19" fill="#241914" />
          </svg>

          {/* Camada 2 — ponteiros das horas e dos minutos (cada um com bisel:
              corpo escuro por baixo e filete claro por cima) */}
          <svg {...layer} className="clock-layer clock-layer--hands">
            <g transform={`rotate(${angles.hour} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="28" className="home-clock-hand home-clock-hand--hour" style={{ stroke: "#f7efe6" }} />
              <line x1="49.4" y1="49" x2="49.4" y2="29" className="home-clock-hand home-clock-hand--hour home-clock-hand--lit" style={{ stroke: "#ffffff" }} />
            </g>
            <g transform={`rotate(${angles.minute} 50 50)`}>
              <line x1="50" y1="54" x2="50" y2="17" className="home-clock-hand home-clock-hand--minute" style={{ stroke: "#f7efe6" }} />
              <line x1="49.6" y1="52" x2="49.6" y2="19" className="home-clock-hand home-clock-hand--minute home-clock-hand--lit" style={{ stroke: "#ffffff" }} />
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
    </>
  )

  return (
    <div
      className={`home-clock home-clock--${clockStyle}`}
      role="img"
      aria-label={label}
      onPointerMove={failed ? onTilt : undefined}
      onPointerLeave={failed ? onTiltEnd : undefined}
      onPointerCancel={failed ? onTiltEnd : undefined}
    >
      <div className="home-clock-glass">
        {/* Sombra no "chão": desliza e respira junto com o balanço do relógio. */}
        {!reduced && (
          <motion.span
            className="home-clock-shadow"
            aria-hidden="true"
            animate={{ x: [-7, 7], scaleX: [0.9, 1.08], opacity: [0.7, 1] }}
            transition={{ duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
        )}
        <div className={`home-clock-3d${failed ? '' : ' home-clock-3d--gl'}`} ref={tiltRef}>
          {failed && clockStyle === 'rose' ? (
            <RoseDigitalFace h={h} m={m} className="clock-layer clock-layer--face cface" />
          ) : failed && clockStyle === 'suico' ? (
            <SwissFace h={h} m={m} className="clock-layer clock-layer--face cface" />
          ) : failed ? (
            flat
          ) : (
            <Suspense
              fallback={
                clockStyle === 'rose' ? (
                  <RoseDigitalFace h={h} m={m} className="clock-layer clock-layer--face cface" />
                ) : clockStyle === 'suico' ? (
                  <SwissFace h={h} m={m} className="clock-layer clock-layer--face cface" />
                ) : (
                  flat
                )
              }
            >
              <Clock3D key={clockStyle} variant={clockStyle} onFail={() => setFailed(true)} />
            </Suspense>
          )}
        </div>
      </div>
      {/* Data curta logo abaixo do relógio: "SEX 26 NOV", no fuso do aparelho */}
      <p className="home-clock-date" aria-hidden="true">
        {formatClockDate(now)}
      </p>
    </div>
  )
}
