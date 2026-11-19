import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Banner horizontal de destaque da Home: "Crie seu Cardápio". Foto à esquerda
// (~42%, 16:9 de origem, object-fit: cover) e a chamada à direita. No celular a foto
// vai para cima e o texto fica embaixo. O banner inteiro é clicável e abre a
// experiência dentro do próprio Círcula. A foto vem de Painel → Imagens da
// comunidade; sem ela, entra um fundo suave com a mesma composição.

export function HomeMenuBanner({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="menu-banner-wrap" {...inViewOnce} variants={riseVariants} aria-label="Crie seu Cardápio">
      <button type="button" className="menu-banner" onClick={onOpen}>
        <span className={`menu-banner-photo${image ? '' : ' menu-banner-photo--empty'}`} aria-hidden="true">
          {image && <img src={image} alt="" loading="lazy" decoding="async" />}
        </span>
        <span className="menu-banner-text">
          <span className="menu-banner-eyebrow">Receba bem</span>
          <span className="menu-banner-title">Crie seu Cardápio</span>
          <span className="menu-banner-copy">
            Escolha os pratos, organize os detalhes e receba seus convidados sem complicação.
          </span>
          <span className="menu-banner-cta">Montar meu cardápio</span>
        </span>
      </button>
    </m.section>
  )
}
