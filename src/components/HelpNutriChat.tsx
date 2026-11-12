import { useState } from 'react'
import type { ConversationOverview, ConversationPeer } from '../types/message'
import { ConversationView } from './ConversationView'

// Help Nutri (visão da membro): uma conversa só, com a nutricionista da
// comunidade. Não há busca de outras pessoas nem lista de conversas: só a
// pergunta "Precisa falar com a Nutri?" e um botão que chama a nutri direto.
//
// Regra do serviço: a membro envia UMA mensagem e aguarda; depois que a nutri
// responde, a conversa segue normalmente (a trava fica em ConversationView,
// `singleUntilReply`). O serviço faz parte de um pacote pago à parte: sem ele
// (`hasAccess = false`), a membro vê o aviso e o convite para a página de
// Planos, sem campo de mensagem.

interface HelpNutriChatProps {
  myProfileId: string
  /** Perfil da nutricionista (dona da comunidade). */
  nutriProfileId: string | null
  conversations: ConversationOverview[]
  loading: boolean
  onStartConversation: (otherProfileId: string) => Promise<{ id: string | null; error: string | null }>
  onActivity: () => void
  /** A membro tem o pacote que inclui o Help Nutri? */
  hasAccess: boolean
  onOpenPlans: () => void
}

export function HelpNutriChat({
  myProfileId,
  nutriProfileId,
  conversations,
  loading,
  onStartConversation,
  onActivity,
  hasAccess,
  onOpenPlans,
}: HelpNutriChatProps) {
  const existing = nutriProfileId
    ? (conversations.find((c) => c.other_profile_id === nutriProfileId) ?? null)
    : null
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [startError, setStartError] = useState(false)
  const [calling, setCalling] = useState(false)
  // A conversa só abre quando a membro toca em "Chamar a nutri" — ou direto,
  // se elas já estavam conversando.
  const [called, setCalled] = useState(false)
  const conversationId = existing?.conversation_id ?? createdId
  const alreadyTalking = !!existing?.last_message_body
  const showChat = !!conversationId && (called || alreadyTalking)

  async function callNutri() {
    if (!nutriProfileId || calling) return
    setStartError(false)
    if (conversationId) {
      setCalled(true)
      return
    }
    setCalling(true)
    const { id, error } = await onStartConversation(nutriProfileId)
    setCalling(false)
    if (error || !id) {
      setStartError(true)
      return
    }
    setCreatedId(id)
    setCalled(true)
  }

  const peer: ConversationPeer | null =
    existing && nutriProfileId
      ? { id: nutriProfileId, full_name: existing.other_full_name, avatar_url: existing.other_avatar_url }
      : nutriProfileId
        ? { id: nutriProfileId, full_name: 'Sua nutricionista', avatar_url: null }
        : null

  return (
    <section className="help-nutri">
      <header className="help-nutri-head">
        <p className="help-nutri-eyebrow">Help Nutri</p>
        <h2>Precisa falar com a Nutri?</h2>
        <p className="help-nutri-intro">
          Este é um canal direto com a nutri. Você envia <strong>uma mensagem</strong> e aguarda a resposta;
          depois que ela responder, a conversa continua normalmente.
        </p>
      </header>

      {!hasAccess ? (
        <div className="help-nutri-locked" role="status">
          <p>
            O Help Nutri faz parte de um pacote contratado à parte, e ele ainda não está no seu plano. Por
            isso você não pode enviar mensagens à nutri por aqui.
          </p>
          <button type="button" className="imc-submit help-nutri-plans" onClick={onOpenPlans}>
            Ver planos
          </button>
        </div>
      ) : !nutriProfileId ? (
        <p className="home-muted">Você ainda não faz parte de uma comunidade com nutricionista.</p>
      ) : showChat && conversationId ? (
        <ConversationView
          key={conversationId}
          conversationId={conversationId}
          myProfileId={myProfileId}
          peer={peer}
          onActivity={onActivity}
          singleUntilReply
        />
      ) : (
        <div className="help-nutri-call">
          <button
            type="button"
            className="imc-submit help-nutri-call-btn"
            onClick={() => void callNutri()}
            disabled={calling || loading}
          >
            {calling ? 'Chamando…' : 'Chamar a nutri'}
          </button>
          {startError && (
            <p className="auth-error" role="alert">
              Não foi possível chamar a nutri agora. Tente de novo em instantes.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
