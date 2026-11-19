import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card "Exercícios" da Home, abaixo dos cards finos: foto (Painel → Imagens da
// comunidade) e a chamada. Abre a área Exercícios (matérias + SE EXERCITE EM CASA).

export function HomeExercisesBanner({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="menu-banner-wrap menu-banner-wrap--full" {...inViewOnce} variants={riseVariants} aria-label="Exercícios">
      <button type="button" className="menu-banner menu-banner--full" onClick={onOpen}>
        <span className={`menu-banner-photo${image ? '' : ' menu-banner-photo--empty'}`} aria-hidden="true">
          {image && <img src={image} alt="" loading="lazy" decoding="async" />}
        </span>
        <span className="menu-banner-text">
          <span className="menu-banner-title">Exercícios</span>
          <span className="menu-banner-eyebrow">Se exercite em casa</span>
          <span className="menu-banner-copy">Matérias e uma biblioteca de exercícios com o peso do próprio corpo, no seu ritmo.</span>
        </span>
      </button>
    </m.section>
  )
}
