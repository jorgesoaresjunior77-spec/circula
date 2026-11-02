import { useMemo, useState } from 'react'
import { buildInviteMessageSuggestions } from '../lib/communityInviteMessages'

// Etapa 4 (evolução/gamificação) — "Convidar mulheres para a
// comunidade" no Painel da Profissional, por WhatsApp.
//
// Não existe hoje nenhum link de convite público reutilizável no
// projeto (pesquisado: InviteMemberForm.tsx é um convite por E-MAIL,
// que cria conta diretamente via Edge Function `invite-member` — nunca
// gera uma URL; o fluxo de "solicitação de entrada" existente
// (membership_requested) é só para quem JÁ tem conta no Círcula
// descobrindo a comunidade dentro do app). Por isso o link usado aqui é
// a própria URL pública do app (mesmo `APP_URL` de Login.tsx:
// `window.location.origin + import.meta.env.BASE_URL` — funciona tanto
// em localhost quanto no domínio real do GitHub Pages, sem hardcode).
//
// 100% client-side, sem tabela/RPC/Edge Function nova: compõe o texto,
// deixa copiar, e abre `https://wa.me/?text=...` (mecanismo padrão de
// link do WhatsApp) numa nova aba, com o texto pré-preenchido na
// conversa que a Profissional escolher lá dentro. NUNCA afirma que a
// mensagem foi enviada — só que o WhatsApp foi aberto; o envio em si
// acontece de lá, pela própria Profissional (ver `o botão abre o
// WhatsApp` abaixo).
interface CommunityInviteWhatsAppProps {
  communityName: string
}

const COPY_RESET_MS = 2000

export function CommunityInviteWhatsApp({ communityName }: CommunityInviteWhatsAppProps) {
  const publicUrl = useMemo(() => `${window.location.origin}${import.meta.env.BASE_URL}`, [])
  const suggestions = useMemo(
    () => buildInviteMessageSuggestions(communityName, publicUrl),
    [communityName, publicUrl],
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
    <section className="community-card community-pro-form" aria-label="Convidar pelo WhatsApp">
      <h3>Convidar pelo WhatsApp</h3>
      <p className="challenge-field-hint">
        Escreva sua própria mensagem ou escolha uma sugestão abaixo — o texto é
        todo seu, pode editar livremente. Ao compartilhar, o WhatsApp abre com
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
    </section>
  )
}
