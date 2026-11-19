import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card "Dicas de Séries / Filmes" da Home: curadoria para assistir com calma.

export function HomeSeriesBanner({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="menu-banner-wrap menu-banner-wrap--full" {...inViewOnce} variants={riseVariants} aria-label="Dicas de Séries e Filmes">
      <button type="button" className="menu-banner menu-banner--full" onClick={onOpen}>
        <span className={`menu-banner-photo${image ? '' : ' menu-banner-photo--empty'}`} aria-hidden="true">
          {image && <img src={image} alt="" loading="lazy" decoding="async" />}
        </span>
        <span className="menu-banner-text">
          <span className="menu-banner-title">Dicas de Séries / Filmes</span>
          <span className="menu-banner-eyebrow">Para assistir com calma</span>
          <span className="menu-banner-copy">Indicações para a comunidade, com onde assistir e a classificação de cada uma.</span>
        </span>
      </button>
    </m.section>
  )
}
