import type { ConversationOverview } from '../types/message'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { EmptyState } from './EmptyState'

interface ConversationListProps {
  conversations: ConversationOverview[]
  loading: boolean
  error: string | null
  selectedId: string | null
  myProfileId: string
  onSelect: (conversationId: string) => void
  onNew: () => void
}

export function ConversationList({
  conversations,
  loading,
  error,
  selectedId,
  myProfileId,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <div className="conversation-list">
      <div className="conversation-list-head">
        <p className="section-label">Conversas</p>
        <button type="button" className="conversation-new-button" onClick={onNew}>
          Nova conversa
        </button>
      </div>

      {loading && conversations.length === 0 && <p className="home-muted">Carregando...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}
      {!loading && !error && conversations.length === 0 && (
        <EmptyState message="Nenhuma conversa ainda. Comece uma nova." />
      )}

      <ul className="conversation-list-items">
        {conversations.map((item) => {
          const name = item.other_full_name ?? 'Participante'
          const mine = item.last_message_sender_id === myProfileId
          const preview = item.last_message_body
            ? `${mine ? 'Você: ' : ''}${item.last_message_body}`
            : 'Conversa iniciada'
          return (
            <li key={item.conversation_id}>
              <button
                type="button"
                className={`conversation-row${
                  selectedId === item.conversation_id ? ' conversation-row--active' : ''
                }`}
                onClick={() => onSelect(item.conversation_id)}
              >
                <span className="conversation-avatar" aria-hidden="true">
                  {item.other_avatar_url ? (
                    <img src={item.other_avatar_url} alt="" />
                  ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="conversation-row-body">
                  <span className="conversation-row-top">
                    <span className="conversation-row-name">{name}</span>
                    <span className="conversation-row-time">
                      {formatRelativeTime(item.last_message_at)}
                    </span>
                  </span>
                  <span className="conversation-row-preview">
                    <span
                      className={`conversation-row-text${
                        item.unread_count > 0 ? ' conversation-row-text--unread' : ''
                      }`}
                    >
                      {preview}
                    </span>
                    {item.unread_count > 0 && (
                      <span className="conversation-unread">{item.unread_count}</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
