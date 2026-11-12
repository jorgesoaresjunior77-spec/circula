import { useEffect, useRef } from 'react'
import { useConversation } from '../hooks/useConversation'
import type { ConversationPeer } from '../types/message'
import { MessageComposer } from './MessageComposer'
import { ChevronLeftIcon } from './icons'

interface ConversationViewProps {
  conversationId: string
  myProfileId: string
  peer: ConversationPeer | null
  /** Sem isto, a conversa não mostra o botão de voltar (Help Nutri da membro). */
  onBack?: () => void
  onActivity: () => void
  /**
   * Help Nutri: a membro envia UMA mensagem e aguarda. Enquanto a outra
   * pessoa não responder, o campo de mensagem fica fechado.
   */
  singleUntilReply?: boolean
}

const TIME_FMT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function ConversationView({
  conversationId,
  myProfileId,
  peer,
  onBack,
  onActivity,
  singleUntilReply = false,
}: ConversationViewProps) {
  const { messages, otherLastReadAt, loading, error, sending, sendMessage, markRead } =
    useConversation(conversationId, myProfileId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Marca como lida ao abrir e sempre que chegam mensagens novas.
  useEffect(() => {
    markRead().then(onActivity)
  }, [conversationId, messages.length, markRead, onActivity])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const myLastOutgoing = [...messages].reverse().find((m) => m.sender_id === myProfileId)
  const peerName = peer?.full_name ?? 'Participante'
  const peerReplied = messages.some((m) => m.sender_id !== myProfileId)
  const waitingReply = singleUntilReply && !loading && !!myLastOutgoing && !peerReplied

  return (
    <div className="conversation-view">
      <header className="conversation-view-head">
        {onBack && (
          <button
            type="button"
            className="conversation-back"
            onClick={onBack}
            aria-label="Voltar para a lista de conversas"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <span className="conversation-avatar" aria-hidden="true">
          {peer?.avatar_url ? (
            <img loading="lazy" decoding="async" src={peer.avatar_url} alt="" />
          ) : (
            <span>{peerName.charAt(0).toUpperCase()}</span>
          )}
        </span>
        <span className="conversation-view-name">{peerName}</span>
      </header>

      <div className="conversation-messages" ref={scrollRef}>
        {loading && messages.length === 0 && <p className="home-muted">Carregando mensagens...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="conversation-empty">
            Nenhuma mensagem ainda. Diga oi para {peerName.split(' ')[0]}
          </p>
        )}

        {messages.map((message) => {
          const mine = message.sender_id === myProfileId
          const read =
            mine &&
            myLastOutgoing?.id === message.id &&
            otherLastReadAt != null &&
            otherLastReadAt >= message.created_at
          return (
            <div
              key={message.id}
              className={`message-bubble${mine ? ' message-bubble--mine' : ''}`}
            >
              <span className="message-bubble-body">{message.body}</span>
              <span className="message-bubble-meta">
                {TIME_FMT.format(new Date(message.created_at))}
                {read && <span className="message-bubble-read"> · lida</span>}
              </span>
            </div>
          )
        })}
      </div>

      {waitingReply ? (
        <p className="conversation-waiting" role="status">
          Sua mensagem foi enviada. Assim que {peerName.split(' ')[0]} responder, você poderá continuar a
          conversa.
        </p>
      ) : (
        <MessageComposer
          onSend={async (body) => {
            const result = await sendMessage(body)
            if (!result.error) onActivity()
            return result
          }}
          disabled={sending}
        />
      )}
    </div>
  )
}
