import { m, inViewOnce, riseVariants, SPRING_TAP } from '../lib/motionKit'
import type { CityInfo } from '../lib/city'

// Card largo "Na minha cidade", logo depois dos Círculos e antes de "Descobrir".
// Mesmo visual dos cards da seção Descobrir (foto de fundo, título serifado).
// Só o título "Minha cidade" e a frase "Ache locais e profissionais" (sem nome da cidade nem chamada).

interface HomeCityCardProps {
  city: CityInfo | null
  image?: string | null
  onOpen: () => void
  /** Bolinha vermelha: novidades na cidade (cadastros novos, pedidos para a profissional). */
  badge?: number
}

export function HomeCityCard({ image, onOpen, badge = 0 }: HomeCityCardProps) {
  return (
    <section className="home-city-wrap" aria-label="Minha cidade">
      <m.button
        type="button"
        className="home-editorial-card home-city-card"
        onClick={onOpen}
        {...inViewOnce}
        variants={riseVariants}
        whileTap={{ y: 4, transition: SPRING_TAP }}
      >
        {badge > 0 && <span className="notif-dot notif-dot--mini" aria-label="Novidade" />}
        <span className="home-editorial-card-media">
          {image ? (
            <img loading="lazy" decoding="async" src={image} alt="" className="home-editorial-card-photo" />
          ) : (
            <span className="home-editorial-card-media-fallback" aria-hidden="true" />
          )}
        </span>
        <span className="home-editorial-card-body">
          <span className="home-editorial-card-eyebrow">Ache locais e profissionais</span>
          <span className="home-editorial-card-title">Minha cidade</span>
        </span>
      </m.button>
    </section>
  )
}
