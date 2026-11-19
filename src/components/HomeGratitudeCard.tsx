import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { PrayingHands } from './PrayingHands'

// Card "Diário da Gratidão": fica no espaço livre à direita do card Meu Chef.
// Fundo de amanhecer (champanhe, bege e caramelo), as mãos em oração animadas
// e a chamada. A foto (opcional) vem de Painel → Imagens da comunidade.

export function HomeGratitudeCard({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="gratitude-card-wrap" {...inViewOnce} variants={riseVariants} aria-label="Diário da Gratidão">
      <button type="button" className="gratitude-card" onClick={onOpen}>
        {image && <img className="gratitude-card-bg" src={image} alt="" loading="lazy" decoding="async" />}
        <span className="gratitude-card-hands">
          <PrayingHands size={64} label="" />
        </span>
        <span className="gratitude-card-title">Diário da Gratidão</span>
        <span className="gratitude-card-cta">Começar agora</span>
      </button>
    </m.section>
  )
}
