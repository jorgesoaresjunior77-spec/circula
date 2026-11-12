import { useEffect, useRef, useState } from 'react'
import type { ConversationOverview, ConversationPeer } from '../types/message'
import { ConversationView } from './ConversationView'

// Help Nutri (visão da membro): uma conversa só, com a nutricionista da
// comunidade. Não há busca de outras pessoas nem lista de conversas.
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
  const starting = useRef(false)
  const conversationId = existing?.conversation_id ?? createdId

  // Primeira visita com acesso: abre a conversa com a nutri (vazia).
  useEffect(() => {
    if (!hasAccess || loading || !nutriProfileId || conversationId || starting.current) return
    starting.current = true
    void onStartConversation(nutriProfileId).then(({ id, error }) => {
      starting.current = false
      if (error || !id) setStartError(true)
      else setCreatedId(id)
    })
  }, [hasAccess, loading, nutriProfileId, conversationId, onStartConversation])

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
        <h2>Fale com a sua nutricionista</h2>
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
      ) : startError ? (
        <p className="auth-error" role="alert">
          Não foi possível abrir a conversa com a nutri agora. Tente de novo em instantes.
        </p>
      ) : conversationId ? (
        <ConversationView
          key={conversationId}
          conversationId={conversationId}
          myProfileId={myProfileId}
          peer={peer}
          onActivity={onActivity}
          singleUntilReply
        />
      ) : (
        <p className="home-muted">Abrindo a conversa…</p>
      )}
    </section>
  )
}
