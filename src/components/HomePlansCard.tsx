import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card fino "Planos e assinaturas": só a escrita por cima da imagem que a
// nutricionista envia em Painel → Imagens da comunidade (sem imagem, vira um
// cartão bege com o mesmo texto).

export function HomePlansCard({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className={`home-plans-card${image ? ' home-plans-card--photo' : ''}`} onClick={onOpen}>
        {image && <img className="home-plans-bg" src={image} alt="" loading="lazy" decoding="async" />}
        <span className="home-plans-title">Planos e assinaturas</span>
      </button>
    </m.section>
  )
}
