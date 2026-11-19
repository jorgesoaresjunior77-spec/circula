import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { PrayingHands } from './PrayingHands'

// Card "Diário da Gratidão": ao lado do Meu Chef, com a mesma altura e o mesmo
// efeito (moldura, sombra, foto com zoom suave). A foto é a das mãos em oração
// (animada); se a nutricionista enviar uma imagem própria em Painel → Imagens
// da comunidade, ela entra no lugar.

export function HomeGratitudeCard({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="menu-banner-wrap gratitude-card-wrap" {...inViewOnce} variants={riseVariants} aria-label="Diário da Gratidão">
      <button type="button" className="menu-banner gratitude-card" onClick={onOpen}>
        <span className="menu-banner-photo gratitude-photo" aria-hidden="true">
          {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <PrayingHands size={92} label="" />}
        </span>
        <span className="menu-banner-text">
          <span className="menu-banner-title gratitude-title">Diário da Gratidão</span>
          <span className="menu-banner-eyebrow">Começar agora</span>
        </span>
      </button>
    </m.section>
  )
}
