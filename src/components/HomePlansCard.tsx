import { useEffect, useRef, useState } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { precarregarRobo, roboUrl } from './RoboGuia'
import type { RoboCena } from './RoboGuia'

// "Planos e Assinaturas": a Livi anda de um canto ao outro da tela e para para apontar para a frase, com carinha
// feliz, piscando e fazendo coração com as mãos. Tocar abre a página de Planos. O texto é o conteúdo; a Livi é só
// decoração. Com "reduzir movimento", ela fica parada apontando para a frase. Só se mexe enquanto está na tela.

const LIVI_W = 84
const FRAMES: RoboCena[] = ['neutro', 'neutro-piscando', 'feliz', 'coracao', 'aponta-baixo', 'comemora']

interface Step {
  /** Posição na faixa: 0 = canto esquerdo, 1 = canto direito. */
  to: number
  /** Duração do passo em ms. */
  ms: number
  /** Anda (alterna os passos) ou fica parada numa pose. */
  walk?: boolean
  cena?: RoboCena
}

// Esquerda -> direita (feliz), coração no canto, volta (piscando), e para no meio apontando para a frase.
const SCRIPT: Step[] = [
  { to: 0, ms: 900, cena: 'feliz' },
  { to: 1, ms: 5200, walk: true },
  { to: 1, ms: 2400, cena: 'coracao' },
  { to: 1, ms: 1100, cena: 'comemora' },
  { to: 0, ms: 5200, walk: true },
  { to: 0, ms: 1200, cena: 'neutro-piscando' },
  { to: 0.5, ms: 2800, walk: true },
  { to: 0.5, ms: 3200, cena: 'aponta-baixo' },
  { to: 0.5, ms: 1600, cena: 'feliz' },
]

export function HomePlansCard({ onOpen }: { image?: string | null; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [step, setStep] = useState(0)
  const [tick, setTick] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    precarregarRobo(FRAMES)
    setReduced(typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Avança o roteiro.
  useEffect(() => {
    if (reduced || !visible) return
    const id = window.setTimeout(() => setStep((s) => (s + 1) % SCRIPT.length), SCRIPT[step].ms)
    return () => window.clearTimeout(id)
  }, [step, visible, reduced])

  // Alterna os passos enquanto anda.
  useEffect(() => {
    if (reduced || !visible || !SCRIPT[step].walk) return
    const id = window.setInterval(() => setTick((t) => !t), 360)
    return () => window.clearInterval(id)
  }, [step, visible, reduced])

  const cur = reduced ? ({ to: 0.5, ms: 0, cena: 'aponta-baixo' } as Step) : SCRIPT[step]
  const prevTo = SCRIPT[(step + SCRIPT.length - 1) % SCRIPT.length].to
  const facingLeft = !!cur.walk && cur.to < prevTo
  const cena: RoboCena = cur.walk ? (tick ? 'neutro' : 'neutro-piscando') : (cur.cena ?? 'neutro')
  // Olhando para onde vai: anda para a esquerda = imagem espelhada.
  const flip = cur.walk && facingLeft ? -1 : 1

  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button ref={ref} type="button" className="home-plans-card home-plans-card--livi" onClick={onOpen}>
        <span className="livi-stage" aria-hidden="true">
          <span
            className={`livi-walker${cur.walk ? ' livi-walker--walking' : ''}`}
            style={{
              left: `calc((100% - ${LIVI_W}px) * ${cur.to})`,
              transition: reduced ? 'none' : cur.walk ? `left ${cur.ms}ms linear` : 'none',
            }}
          >
            <img className="livi-img" src={roboUrl(cena)} alt="" width={LIVI_W} height={Math.round((LIVI_W * 16) / 9)} draggable={false} style={{ transform: `scaleX(${flip})` }} />
          </span>
        </span>
        <span className="home-plans-title">Planos e Assinaturas</span>
      </button>
    </m.section>
  )
}
