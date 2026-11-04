import { useState } from 'react'
import { CommunityInviteWhatsApp } from './CommunityInviteWhatsApp'

// Convite por WhatsApp é a ação mais usada do Painel: o botão fica logo
// abaixo de "Painel da comunidade", em destaque, em qualquer aba. Ao abrir,
// já garante o link de convite da comunidade (gera se ainda não houver) e
// mostra o campo do número de WhatsApp da pessoa.
interface PanelInviteCtaProps {
  communityId: string
  communityName: string
}

export function PanelInviteCta({ communityId, communityName }: PanelInviteCtaProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="panel-invite">
      <button
        type="button"
        className="panel-invite-cta"
        aria-expanded={open}
        aria-controls="panel-invite-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="panel-invite-cta-title">
          {open ? 'Fechar convite' : 'Convidar pelo WhatsApp'}
        </span>
        {!open && (
          <span className="panel-invite-cta-sub">
            Digite o número e a pessoa recebe o link para entrar
          </span>
        )}
      </button>
      {open && (
        <div id="panel-invite-body">
          <CommunityInviteWhatsApp
            communityId={communityId}
            communityName={communityName}
            autoCreate
            showTitle={false}
          />
        </div>
      )}
    </div>
  )
}
