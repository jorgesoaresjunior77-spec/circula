import { useHelpQueue } from '../hooks/useHelpQueue'
import { HelpRequestCard } from './HelpRequestCard'
import { EmptyState } from './EmptyState'
import type { HelpStatus } from '../types/help'

// Fase 5 — fila de Pedidos de ajuda no painel da Nutri.
// Três grupos simples: novos, em andamento e respondidos. A Nutri move
// o status e responde; NÃO apaga o pedido da usuária.
//
// Redesign editorial: classes .panel-help-*, sem .community-card/
// .help-queue-*. HelpRequestCard (compartilhado com a Home) permanece
// intocado — nenhuma lógica (useHelpQueue, setStatus, addReply,
// fetchReplies) mudou, só markup/classes do wrapper da aba.

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
    <section className="panel-help">
      <header className="panel-help-head">
        <p className="panel-help-title">Painel · Pedidos de ajuda</p>
        <p className="panel-help-intro">
          Pedidos das mulheres da sua comunidade. Mova o status e responda quando necessário.
        </p>
      </header>

      {loading && <p className="panel-help-muted">Carregando fila…</p>}
      {!loading && error && (
        <p className="auth-error">
          Não foi possível carregar a fila de pedidos agora. Tente novamente em instantes.
        </p>
      )}

      {!loading &&
        !error &&
        GROUPS.map((group) => {
          const items = byStatus[group.key]
          return (
            <div
              key={group.key}
              className={`panel-help-group${items.length === 0 ? ' panel-help-group--empty' : ''}`}
            >
              <p className="panel-help-group-title">
                {group.label}
                <span className="panel-help-count">{items.length}</span>
              </p>
              {items.length === 0 ? (
                <EmptyState message="Nada por aqui." />
              ) : (
                <div className="panel-help-list">
                  {items.map((request) => (
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
          )
        })}
    </section>
  )
}
