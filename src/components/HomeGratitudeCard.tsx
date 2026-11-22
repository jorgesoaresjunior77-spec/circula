import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card "Diário da Gratidão": ao lado do Meu Chef, com a mesma altura e a mesma
// borda dos cards da Loja. A imagem é a que a nutricionista envia em Painel →
// Imagens da comunidade (sem ela, entra um fundo bege suave); o texto fica
// numa área bege clara.

export function HomeGratitudeCard({
  image,
  onOpen,
  title = 'Diário da Gratidão',
  eyebrow = 'Um minuto de gratidão',
}: {
  image: string | null
  onOpen: () => void
  title?: string
  eyebrow?: string
}) {
  return (
    <m.section className="menu-banner-wrap gratitude-card-wrap" {...inViewOnce} variants={riseVariants} aria-label={title}>
      <button type="button" className="menu-banner gratitude-card" onClick={onOpen}>
        <span className={`menu-banner-photo gratitude-photo${image ? '' : ' menu-banner-photo--empty'}`} aria-hidden="true">
          {image && <img src={image} alt="" loading="lazy" decoding="async" />}
        </span>
        <span className="menu-banner-text gratitude-text">
          <span className="menu-banner-title gratitude-title">{title}</span>
          <span className="menu-banner-eyebrow">{eyebrow}</span>
        </span>
      </button>
    </m.section>
  )
}
