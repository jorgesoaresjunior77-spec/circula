import { Suspense, lazy, useState } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import marluce from '../assets/marluce-planos.webp'
import type { PlanCardImages } from './PlansCarousel3D'

// "Planos e Assinaturas": a Marluce apresenta os planos e, na frente dela, cinco cartões em 3D dão a volta
// completa (um vem para a frente enquanto outro vai para trás). Tocar abre a página de Planos.
// Com "reduzir movimento" o anel fica parado; sem WebGL, três cartões simples ocupam o lugar.

const PlansCarousel3D = lazy(() => import('./PlansCarousel3D'))

interface Props {
  /** Foto da Marluce cadastrada no Painel (PNG/WebP com fundo transparente); sem ela, usa a foto padrão. */
  image?: string | null
  /** Fotos dos três cartões (Painel → Imagens → Planos e assinaturas). */
  cardImages?: PlanCardImages
  onOpen: () => void
}

function FallbackCards({ images }: { images: PlanCardImages }) {
  const cards: { key: keyof PlanCardImages; nome: string; cls: string }[] = [
    { key: 'mensal', nome: 'Plano Mensal', cls: 'plans3d-flat--left' },
    { key: 'frente', nome: 'Planos e Assinaturas', cls: 'plans3d-flat--front' },
    { key: 'premium', nome: 'Plano Premium', cls: 'plans3d-flat--right' },
  ]
  return (
    <div className="plans3d-flat" aria-hidden="true">
      {cards.map((c) => (
        <span key={c.key} className={`plans3d-flat-card ${c.cls}`}>
          {images[c.key] ? <img src={images[c.key] as string} alt="" /> : <i>✿</i>}
          <b>{c.nome}</b>
        </span>
      ))}
    </div>
  )
}

export function HomePlansCard({ image = null, cardImages = {}, onOpen }: Props) {
  const [failed, setFailed] = useState(false)
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className="home-plans-card home-plans-card--3d" onClick={onOpen} aria-label="Planos e assinaturas: ver os planos">
        <img className="plans3d-woman" src={image || marluce} alt="" draggable={false} />
        {failed ? (
          <FallbackCards images={cardImages} />
        ) : (
          <Suspense fallback={null}>
            <PlansCarousel3D images={cardImages} reduced={reduced} onFail={() => setFailed(true)} />
          </Suspense>
        )}
      </button>
    </m.section>
  )
}
