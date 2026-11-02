import { useMemo, useState } from 'react'
import { buildInviteMessageSuggestions } from '../lib/communityInviteMessages'
import { useInviteLink } from '../hooks/useInviteLink'

// Convidar mulheres para a comunidade pelo WhatsApp (Painel da
// Profissional). O link é UM por comunidade, gerado aqui, e leva a uma
// página de cadastro de participante (`?convite=<token>`, ver
// MemberSignup). A dona pode desativar o link ou gerar outro (o anterior
// deixa de valer na hora) se ele vazar.
//
// O app NUNCA envia nada: compõe o texto, deixa copiar e abre
// `https://wa.me/?text=...` com a mensagem pronta; o envio acontece no
// WhatsApp, pela própria Profissional.
interface CommunityInviteWhatsAppProps {
  communityId: string
  communityName: string
}

const COPY_RESET_MS = 2000

export function CommunityInviteWhatsApp({ communityId, communityName }: CommunityInviteWhatsAppProps) {
  const link = useInviteLink(communityId)

  return (
    <section className="community-card community-pro-form" aria-label="Convidar pelo WhatsApp">
      <h3>Convidar pelo WhatsApp</h3>

      {link.loading ? (
        <p className="challenge-field-hint">Carregando o link de convite…</p>
      ) : link.url ? (
        <>
          <InviteMessageComposer key={link.url} communityName={communityName} inviteUrl={link.url} />

          <p className="challenge-field-hint">
            Quem abre o link cria o próprio acesso (e-mail e senha) e já entra na comunidade.
            Se o link for parar em quem não deveria, desative ou gere um novo: o anterior para de valer na hora.
          </p>
          <div className="invite-whatsapp-actions">
            <button type="button" className="invite-whatsapp-copy" onClick={() => void link.regenerate()} disabled={link.busy}>
              Gerar um novo link
            </button>
            <button type="button" className="invite-whatsapp-copy" onClick={() => void link.revoke()} disabled={link.busy}>
              Desativar link
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="challenge-field-hint">
            Gere o link de convite da comunidade. Depois é só enviar pelo WhatsApp: quem abrir cria o próprio
            acesso e entra em {communityName}.
          </p>
          <div className="invite-whatsapp-actions">
            <button type="button" className="invite-whatsapp-share" onClick={() => void link.create()} disabled={link.busy}>
              {link.busy ? 'Gerando…' : 'Gerar link de convite'}
            </button>
          </div>
        </>
      )}

      {link.error && (
        <p className="auth-error" role="alert">
          {link.error}
        </p>
      )}
    </section>
  )
}

interface InviteMessageComposerProps {
  communityName: string
  inviteUrl: string
}

export function InviteMessageComposer({ communityName, inviteUrl }: InviteMessageComposerProps) {
  const suggestions = useMemo(
    () => buildInviteMessageSuggestions(communityName, inviteUrl),
    [communityName, inviteUrl],
  )
  const [message, setMessage] = useState(suggestions[0])
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
    setTimeout(() => setCopyState('idle'), COPY_RESET_MS)
  }

  function handleShare() {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <p className="challenge-field-hint">
        Escreva sua própria mensagem ou escolha uma sugestão abaixo — o texto é
        todo seu, pode editar livremente (mantenha o link). Ao compartilhar, o WhatsApp abre com
        a mensagem pronta; o envio é feito por você, de lá.
      </p>

      <div className="invite-whatsapp-suggestions">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            className={`invite-whatsapp-chip${message === suggestion ? ' invite-whatsapp-chip--active' : ''}`}
            onClick={() => setMessage(suggestion)}
          >
            Sugestão {index + 1}
          </button>
        ))}
      </div>

      <label htmlFor="invite-whatsapp-message">Mensagem</label>
      <textarea
        id="invite-whatsapp-message"
        className="invite-whatsapp-textarea"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={6}
      />

      <div className="invite-whatsapp-actions">
        <button
          type="button"
          className="invite-whatsapp-copy"
          onClick={() => void handleCopy()}
          disabled={!message.trim()}
        >
          {copyState === 'copied' ? 'Copiado!' : copyState === 'error' ? 'Não foi possível copiar' : 'Copiar mensagem'}
        </button>
        <button
          type="button"
          className="invite-whatsapp-share"
          onClick={handleShare}
          disabled={!message.trim()}
        >
          Compartilhar no WhatsApp
        </button>
      </div>
    </>
  )
}
