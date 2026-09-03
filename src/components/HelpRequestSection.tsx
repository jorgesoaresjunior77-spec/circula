import { useState } from 'react'
import { useHelpRequests } from '../hooks/useHelpRequests'
import { HelpRequestForm } from './HelpRequestForm'
import { HelpRequestCard } from './HelpRequestCard'
import { HeartIcon } from './icons'

// Fase 5 — faixa "Pedido de ajuda" na Home.
//
// Muito visível, logo abaixo de "Como você está hoje?". Um botão grande
// e claro abre o formulário; abaixo, os pedidos que a usuária pode ver
// (os dela + os "para a comunidade").

interface HelpRequestSectionProps {
  communityId: string
  communityOwnerId: string
  profileId: string
  onOpenConversation: (conversationId: string) => void
}

const PREVIEW_COUNT = 3

export function HelpRequestSection({
  communityId,
  communityOwnerId,
  profileId,
  onOpenConversation,
}: HelpRequestSectionProps) {
  const {
    requests,
    repliesByRequest,
    loading,
    error,
    createRequest,
    updateRequest,
    deleteRequest,
    addReply,
    fetchReplies,
  } = useHelpRequests(communityId, profileId, communityOwnerId)

  const [formOpen, setFormOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? requests : requests.slice(0, PREVIEW_COUNT)

  async function handleSubmit(input: { body: string; audience: 'nutri' | 'community' }) {
    const result = await createRequest(input)
    if (!result.error) {
      setFormOpen(false)
      if (input.audience === 'nutri' && result.conversationId) {
        onOpenConversation(result.conversationId)
      }
    }
    return { error: result.error }
  }

  return (
    <section className="home-section help-section" aria-labelledby="help-section-title">
      <div className="help-section-head">
        <div>
          <h3 id="help-section-title" className="home-section-title">
            Quer conversar sobre alguma coisa?
          </h3>
          <p className="help-section-sub">
            Não se sinta sozinha. Você pode pedir ajuda quando precisar — para a Nutri ou para as
            outras mulheres do Círcula. 🤍
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            className="help-primary-button help-cta"
            onClick={() => setFormOpen(true)}
          >
            <HeartIcon size={18} />
            Pedir ajuda
          </button>
        )}
      </div>

      {formOpen && (
        <HelpRequestForm onSubmit={handleSubmit} onCancel={() => setFormOpen(false)} />
      )}

      {loading && <p className="home-muted">Carregando pedidos…</p>}
      {!loading && error && (
        <p className="auth-error">
          Não foi possível carregar os pedidos de ajuda agora. Tente novamente em instantes.
        </p>
      )}

      {!loading && !error && requests.length === 0 && !formOpen && (
        <p className="help-section-note">
          Nenhum pedido por aqui agora — e tudo bem. Dias difíceis passam, e a comunidade está
          aqui quando você quiser. 🌷
        </p>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="help-list">
          {visible.map((request) => (
            <HelpRequestCard
              key={request.id}
              request={request}
              viewerId={profileId}
              replies={repliesByRequest[request.id]}
              onFetchReplies={() => fetchReplies(request.id)}
              onReply={(body) => addReply(request.id, body)}
              onEdit={
                request.profile_id === profileId
                  ? (body) => updateRequest(request.id, body)
                  : undefined
              }
              onDelete={
                request.profile_id === profileId
                  ? () => deleteRequest(request.id)
                  : undefined
              }
              onOpenConversation={onOpenConversation}
            />
          ))}
        </div>
      )}

      {!loading && !error && requests.length > PREVIEW_COUNT && (
        <button
          type="button"
          className="home-section-link"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Mostrar menos' : `Ver todos (${requests.length})`}
        </button>
      )}
    </section>
  )
}
