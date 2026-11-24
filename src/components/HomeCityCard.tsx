import { m, inViewOnce, riseVariants, SPRING_TAP } from '../lib/motionKit'
import type { CityInfo } from '../lib/city'

// Card largo "Na minha cidade", logo depois dos Círculos e antes de "Descobrir".
// Mesmo visual dos cards da seção Descobrir (foto de fundo, título serifado).
// Depois que a participante escolhe a cidade, mostra o nome dela e os números.

interface HomeCityCardProps {
  city: CityInfo | null
  image?: string | null
  onOpen: () => void
  /** Bolinha vermelha: novidades na cidade (cadastros novos, pedidos para a profissional). */
  badge?: number
}

export function HomeCityCard({ city, image, onOpen, badge = 0 }: HomeCityCardProps) {
  const mulheres = city ? `${city.mulheres} ${city.mulheres === 1 ? 'mulher' : 'mulheres'}` : null
  const cadastros = city ? `${city.cadastros} ${city.cadastros === 1 ? 'cadastro' : 'cadastros'}` : null
  return (
    <section className="home-city-wrap" aria-label="Na minha cidade">
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
          <span className="home-editorial-card-eyebrow">CONEXÃO · PROXIMIDADE</span>
          <span className="home-editorial-card-title">{city ? `Na minha cidade · ${city.nome}` : 'Na minha cidade'}</span>
          {city && (
            <span className="home-editorial-card-subtitle">
              {mulheres} · {cadastros}
            </span>
          )}
          <span className="home-editorial-card-cta">
            {city ? 'Abrir a minha cidade' : 'Encontre mulheres da sua cidade'} <span aria-hidden="true">→</span>
          </span>
        </span>
      </m.button>
    </section>
  )
}
