import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCESS_CODE_INVITE_LINE } from '../lib/accessCode'
import { buildInviteMessageSuggestions } from '../lib/communityInviteMessages'
import { useInviteLink } from '../hooks/useInviteLink'
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '../lib/phone'

// Convidar mulheres para a comunidade pelo WhatsApp (Painel da
// Profissional). O link é UM por comunidade, gerado aqui, e leva a uma
// página de cadastro de participante (`?convite=<token>`, ver
// MemberSignup). A dona pode desativar o link ou gerar outro (o anterior
// deixa de valer na hora) se ele vazar.
//
// O app NUNCA envia nada: a Profissional digita o número de WhatsApp da
// pessoa, o app compõe o texto e abre `https://wa.me/<número>?text=...` com
// a conversa já aberta e a mensagem pronta; o envio acontece no WhatsApp,
// pela própria Profissional. Também dá para copiar o texto ou escolher o
// contato direto no WhatsApp (`wa.me/?text=`).
interface CommunityInviteWhatsAppProps {
  communityId: string
  communityName: string
  /** Gera o link sozinho ao abrir, se ainda não houver um ativo (ex.: botão do topo do Painel). */
  autoCreate?: boolean
  /** Esconde o título interno quando um botão externo já o anuncia. */
  showTitle?: boolean
}

const COPY_RESET_MS = 2000

export function CommunityInviteWhatsApp({ communityId, communityName, autoCreate = false, showTitle = true }: CommunityInviteWhatsAppProps) {
  const link = useInviteLink(communityId)
  const { loading, url, busy, error, create } = link
  // Acesso ilimitado para esta pessoa: gera um código (uso único) que vai junto na mensagem.
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  async function toggleAccessCode() {
    if (accessCode) {
      setAccessCode(null)
      return
    }
    setCodeBusy(true)
    setCodeError(null)
    const { data, error: e } = await supabase.rpc('create_access_code', { p_community_id: communityId, p_note: 'Convite pelo WhatsApp' })
    setCodeBusy(false)
    if (e || typeof data !== 'string') setCodeError('Não foi possível gerar o código agora.')
    else setAccessCode(data)
  }

  useEffect(() => {
    if (autoCreate && !loading && !url && !busy && !error) void create()
    // `create` muda a cada render do hook; só reage a estado, não à identidade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, loading, url, busy, error])

  return (
    <section className="community-card community-pro-form" aria-label="Convidar pelo WhatsApp">
      {showTitle && <h3>Convidar pelo WhatsApp</h3>}

      {link.loading ? (
        <p className="challenge-field-hint">Carregando o link de convite…</p>
      ) : link.url ? (
        <>
          <div className="invite-access-code">
            <label className="invite-access-code-toggle">
              <input type="checkbox" checked={!!accessCode} onChange={() => void toggleAccessCode()} disabled={codeBusy} />
              Dar acesso ilimitado a esta pessoa (vai um código na mensagem)
            </label>
            {accessCode && (
              <p className="challenge-field-hint">
                Código <strong>{accessCode}</strong>: ela digita no primeiro acesso e fica com o Círcula inteiro, sem cobrança. Vale para uma pessoa só.
              </p>
            )}
            {codeError && <p className="auth-error">{codeError}</p>}
          </div>
          <InviteMessageComposer key={link.url} communityName={communityName} inviteUrl={link.url} accessCode={accessCode} />

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

export const INVITE_LINK_LABEL = '@circulaapp'

/** Troca a frase @circulaapp pelo link real; sem a frase, o link vai no fim da mensagem. */
export function withRealLink(message: string, inviteUrl: string): string {
  if (message.includes(INVITE_LINK_LABEL)) return message.split(INVITE_LINK_LABEL).join(inviteUrl)
  return `${message.trimEnd()}

${inviteUrl}`
}

interface InviteMessageComposerProps {
  communityName: string
  inviteUrl: string
  /** Convite feito de dentro de um Círculo. */
  circleName?: string
  /** Quem convida tem o Premium: o convite cita o desconto extra. */
  premiumBonus?: boolean
  /** Código de acesso ilimitado que vai no fim da mensagem (Painel da nutricionista). */
  accessCode?: string | null
}

export function InviteMessageComposer({ communityName, inviteUrl, circleName, premiumBonus, accessCode = null }: InviteMessageComposerProps) {
  // Na tela o link aparece como a frase @circulaapp; o endereço de verdade entra na
  // mensagem só na hora de enviar, copiar ou compartilhar.
  const suggestions = useMemo(
    () => buildInviteMessageSuggestions(communityName, INVITE_LINK_LABEL, { circleName, premiumBonus }),
    [communityName, circleName, premiumBonus],
  )
  const [message, setMessage] = useState(suggestions[0])
  const finalMessage = accessCode
    ? `${withRealLink(message, inviteUrl).trimEnd()}

${ACCESS_CODE_INVITE_LINE(accessCode)}`
    : withRealLink(message, inviteUrl)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [phone, setPhone] = useState('')
  const number = normalizeWhatsAppNumber(phone)
  const phoneInvalid = phone.trim() !== '' && number === null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finalMessage)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
    setTimeout(() => setCopyState('idle'), COPY_RESET_MS)
  }

  function handleSendToNumber() {
    if (!number) return
    window.open(buildWhatsAppUrl(number, finalMessage), '_blank', 'noopener,noreferrer')
  }

  function handleShare() {
    const url = `https://wa.me/?text=${encodeURIComponent(finalMessage)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <label htmlFor="invite-whatsapp-phone">WhatsApp da pessoa</label>
      <input
        id="invite-whatsapp-phone"
        className="invite-whatsapp-phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="(51) 99999-9999"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        aria-invalid={phoneInvalid}
        aria-describedby="invite-whatsapp-phone-hint"
      />
      <p
        id="invite-whatsapp-phone-hint"
        className={phoneInvalid ? 'auth-error' : 'challenge-field-hint'}
        role={phoneInvalid ? 'alert' : undefined}
      >
        {phoneInvalid
          ? 'Número inválido. Digite o DDD e o número, por exemplo (51) 99999-9999.'
          : 'Com DDD. O WhatsApp abre na conversa dessa pessoa, com a mensagem pronta; o envio é você quem faz, de lá.'}
      </p>

      <p className="invite-mask-row">
        Link de convite:{' '}
        <a className="invite-mask" href={inviteUrl} target="_blank" rel="noopener noreferrer" title={inviteUrl}>
          {INVITE_LINK_LABEL}
        </a>
      </p>
      <p className="challenge-field-hint">
        A mensagem é toda sua: escolha uma sugestão ou escreva a sua e mantenha a frase @circulaapp, que vira o link na hora de enviar.
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
          className="invite-whatsapp-send"
          onClick={handleSendToNumber}
          disabled={!number || !message.trim()}
        >
          Enviar pelo WhatsApp
        </button>
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
