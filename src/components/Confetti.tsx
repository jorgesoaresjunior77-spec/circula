import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

// Confete de celebração, só CSS (sem biblioteca, sem arquivo de animação):
// dispara quando `fire` passa de falso a verdadeiro DEPOIS de a tela abrir,
// então quem entra e já tinha batido a meta não vê confete de novo. Some
// sozinho, não recebe toque e não aparece com "reduzir movimento".

const COLORS = ['#e8b84a', '#e07a9f', '#7fbf9a', '#6fa8dc', '#c88fd6', '#f2a65a']
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 37) % 100) - 50, // deslocamento horizontal (px/2)
  rise: 90 + ((i * 53) % 90),
  fall: 160 + ((i * 29) % 120),
  spin: ((i * 71) % 720) - 360,
  delay: (i % 7) * 0.04,
  color: COLORS[i % COLORS.length],
  w: 6 + (i % 3) * 2,
}))

export function Confetti({ fire, ready = true }: { fire: boolean; /** Só depois que os dados da tela carregaram. */ ready?: boolean }) {
  const [burst, setBurst] = useState(0)
  const prev = useRef(fire)
  const armed = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!armed.current) {
      // primeira leitura com a tela pronta: só anota o estado, não comemora
      armed.current = true
      prev.current = fire
      return
    }
    if (fire && !prev.current) {
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        prev.current = fire
        return
      }
      setBurst((n) => n + 1)
      const t = window.setTimeout(() => setBurst(0), 2200)
      prev.current = fire
      return () => window.clearTimeout(t)
    }
    prev.current = fire
  }, [fire, ready])

  if (!burst) return null
  return (
    <div className="confetti" aria-hidden="true" key={burst}>
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${p.x * 2}px`,
              '--rise': `${-p.rise}px`,
              '--fall': `${p.fall}px`,
              '--spin': `${p.spin}deg`,
              background: p.color,
              width: p.w,
              height: p.w * 1.6,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
