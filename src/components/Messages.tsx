import { useEffect, useMemo, useState } from 'react'
import type { ConversationOverview, ConversationPeer } from '../types/message'
import { ConversationList } from './ConversationList'
import { ConversationView } from './ConversationView'
import { NewConversation } from './NewConversation'

interface MessagesProps {
  myProfileId: string
  conversations: ConversationOverview[]
  loading: boolean
  error: string | null
  /** Abrir direto uma conversa (vindo de ProfileCard ou NotificationBell). */
  initialConversationId: string | null
  onConsumedInitial: () => void
  onStartConversation: (otherProfileId: string) => Promise<{ id: string | null; error: string | null }>
  onActivity: () => void
}

type Pane = 'list' | 'thread' | 'new'

export function Messages({
  myProfileId,
  conversations,
  loading,
  error,
  initialConversationId,
  onConsumedInitial,
  onStartConversation,
  onActivity,
}: MessagesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
  const [pane, setPane] = useState<Pane>(initialConversationId ? 'thread' : 'list')
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId)
      setPane('thread')
      onConsumedInitial()
    }
  }, [initialConversationId, onConsumedInitial])

  const peer: ConversationPeer | null = useMemo(() => {
    const row = conversations.find((c) => c.conversation_id === selectedId)
    if (!row) return null
    return {
      id: row.other_profile_id,
      full_name: row.other_full_name,
      avatar_url: row.other_avatar_url,
    }
  }, [conversations, selectedId])

  function handleSelect(conversationId: string) {
    setSelectedId(conversationId)
    setPane('thread')
  }

  async function handlePickPerson(otherProfileId: string) {
    setStartError(null)
    const { id, error: opError } = await onStartConversation(otherProfileId)
    if (opError || !id) {
      setStartError('Não foi possível iniciar a conversa com essa pessoa.')
      return
    }
    setSelectedId(id)
    setPane('thread')
  }

  return (
    <section className={`messages messages--${pane}`}>
      <div className="messages-pane messages-pane--list">
        <ConversationList
          conversations={conversations}
          loading={loading}
          error={error}
          selectedId={selectedId}
          myProfileId={myProfileId}
          onSelect={handleSelect}
          onNew={() => setPane('new')}
        />
      </div>

      <div className="messages-pane messages-pane--detail">
        {pane === 'new' ? (
          <NewConversation
            myProfileId={myProfileId}
            onBack={() => setPane('list')}
            onPick={handlePickPerson}
          />
        ) : selectedId ? (
          <ConversationView
            key={selectedId}
            conversationId={selectedId}
            myProfileId={myProfileId}
            peer={peer}
            onBack={() => setPane('list')}
            onActivity={onActivity}
          />
        ) : (
          <div className="messages-empty">
            <p className="home-muted">Selecione uma conversa ou comece uma nova.</p>
          </div>
        )}
        {startError && <p className="auth-error">{startError}</p>}
      </div>
    </section>
  )
}
