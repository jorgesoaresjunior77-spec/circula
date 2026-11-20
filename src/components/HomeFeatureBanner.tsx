import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card de destaque da Home (mesma estrutura e mesmo efeito do Meu Chef): foto
// enviada pela nutricionista, título e uma frase. Usado em "Para você".

export function HomeFeatureBanner({
  title,
  eyebrow,
  copy,
  image,
  label,
  onOpen,
}: {
  title: string
  eyebrow: string
  copy: string
  image: string | null
  label: string
  onOpen: () => void
}) {
  return (
    <m.section className="menu-banner-wrap" {...inViewOnce} variants={riseVariants} aria-label={label}>
      <button type="button" className="menu-banner" onClick={onOpen}>
        <span className={`menu-banner-photo${image ? '' : ' menu-banner-photo--empty'}`} aria-hidden="true">
          {image && <img src={image} alt="" loading="lazy" decoding="async" />}
        </span>
        <span className="menu-banner-text">
          <span className="menu-banner-title">{title}</span>
          <span className="menu-banner-eyebrow">{eyebrow}</span>
          <span className="menu-banner-copy">{copy}</span>
        </span>
      </button>
    </m.section>
  )
}
