import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { RoboGuia } from './RoboGuia'
import { falar } from '../hooks/useRobo'

// Card fino "Planos e assinaturas": só a escrita por cima da imagem que a
// nutricionista envia em Painel → Imagens da comunidade (sem imagem, vira um
// cartão bege com o mesmo texto).

export function HomePlansCard({ image, onOpen }: { image: string | null; onOpen: () => void }) {
  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className={`home-plans-card${image ? ' home-plans-card--photo' : ''}`} onClick={() => {
          falar('apresenta', 'feliz') // o som só toca depois do toque
          onOpen()
        }}>
        {image && <img className="home-plans-bg" src={image} alt="" loading="lazy" decoding="async" />}
        <span className="home-plans-title">Planos e assinaturas</span>
        <span className="robo-compacto-pos">
          <RoboGuia cena="apresenta" tamanho={34} mudo />
        </span>
      </button>
    </m.section>
  )
}
