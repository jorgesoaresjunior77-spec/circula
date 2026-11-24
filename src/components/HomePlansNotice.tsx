import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { CIRCULA_MONTHLY_CENTS, PREMIUM_MONTHLY_CENTS, formatBrl } from '../lib/plansCatalog'

// Aviso pequeno, perto do topo, para quem ainda não assina o Premium: leva à
// página de Planos e assinaturas (o card completo continua no fim da Home).

export function HomePlansNotice({ onOpen }: { onOpen: () => void }) {
  return (
    <m.section className="home-plans-notice-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className="home-plans-notice" onClick={onOpen}>
        <span className="home-plans-notice-text">
          <strong>Planos e assinaturas</strong>
          <span>
            Círcula por {formatBrl(CIRCULA_MONTHLY_CENTS)} e Premium com tudo por {formatBrl(PREMIUM_MONTHLY_CENTS)} por mês
          </span>
        </span>
        <span className="home-plans-notice-cta" aria-hidden="true">
          Ver
        </span>
      </button>
    </m.section>
  )
}
