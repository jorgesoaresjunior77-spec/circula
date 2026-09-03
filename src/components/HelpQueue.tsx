import { useHelpQueue } from '../hooks/useHelpQueue'
import { HelpRequestCard } from './HelpRequestCard'
import { EmptyState } from './EmptyState'
import type { HelpStatus } from '../types/help'

// Fase 5 — fila de Pedidos de ajuda no painel da Nutri.
// Três grupos simples: novos, em andamento e respondidos. A Nutri move
// o status e responde; NÃO apaga o pedido da usuária.

interface HelpQueueProps {
  communityId: string
  profileId: string
  onOpenConversation: (conversationId: string) => void
}

const GROUPS: { key: HelpStatus; label: string }[] = [
  { key: 'open', label: 'Novos' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'resolved', label: 'Respondidos' },
]

export function HelpQueue({ communityId, profileId, onOpenConversation }: HelpQueueProps) {
  const { byStatus, repliesByRequest, loading, error, setStatus, addReply, fetchReplies } =
    useHelpQueue(communityId, profileId)

  return (
    <section className="community-card community-card--quiet help-queue">
      <h3>Pedidos de ajuda</h3>
      <p className="help-queue-intro">
        Pedidos das mulheres da sua comunidade. Você pode mover o status e responder. Os pedidos
        "para a Nutri" abrem a conversa no Mensagens.
      </p>

      {loading && <p>Carregando fila…</p>}
      {!loading && error && (
        <p className="auth-error">
          Não foi possível carregar a fila de pedidos agora. Tente novamente em instantes.
        </p>
      )}

      {!loading &&
        !error &&
        GROUPS.map((group) => (
          <div key={group.key} className="help-queue-group">
            <p className="help-queue-group-title">
              {group.label}
              <span className="help-queue-count">{byStatus[group.key].length}</span>
            </p>
            {byStatus[group.key].length === 0 ? (
              <EmptyState message="Nada por aqui." />
            ) : (
              <div className="help-list">
                {byStatus[group.key].map((request) => (
                  <HelpRequestCard
                    key={request.id}
                    request={request}
                    viewerId={profileId}
                    canManageStatus
                    replies={repliesByRequest[request.id]}
                    onFetchReplies={() => fetchReplies(request.id)}
                    onReply={(body) => addReply(request.id, body)}
                    onSetStatus={(status) => setStatus(request.id, status)}
                    onOpenConversation={onOpenConversation}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
    </section>
  )
}
