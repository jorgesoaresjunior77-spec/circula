import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// "Planos e Assinaturas": o círculo dourado e bege rosé girando, sem fundo, com o nome embaixo.
// Tocar abre a página de Planos. A animação é um arquivo fixo do app (public/circulo-girando.webp).

export function HomePlansCard({ onOpen }: { image?: string | null; onOpen: () => void }) {
  const base = import.meta.env.BASE_URL
  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className="home-plans-card" onClick={onOpen}>
        <img className="home-plans-orb" src={`${base}circulo-girando.webp`} alt="" width={200} height={178} decoding="async" draggable={false} />
        <span className="home-plans-title">Planos e Assinaturas</span>
      </button>
    </m.section>
  )
}
