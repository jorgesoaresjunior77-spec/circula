import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { InviteFriends } from './InviteFriends'

// Página "Convite": a participante chama uma amiga, familiar ou colega. O link
// (mostrado como @circulaapp) leva ao começo do cadastro do app; o envio é
// sempre feito por ela mesma, pelo WhatsApp.

export function InvitePage({ communityId }: { communityId: string | null }) {
  return (
    <div className="invite-page">
      <m.header className="invite-page-hero" {...inViewOnce} variants={riseVariants}>
        <h2>Convide quem você ama</h2>
        <p>
          Chame uma amiga, uma familiar ou uma colega para viver o Círcula com você. Ela abre o link <strong>@circulaapp</strong>,
          faz o cadastro e já entra na comunidade.
        </p>
      </m.header>
      {communityId ? (
        <InviteFriends communityId={communityId} />
      ) : (
        <p className="home-muted">Você ainda não faz parte de nenhuma comunidade.</p>
      )}
    </div>
  )
}
