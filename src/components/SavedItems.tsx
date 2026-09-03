import type { useSavedItems } from '../hooks/useSavedItems'
import type { Post } from '../types/post'
import { ContentCard } from './ContentCard'
import { EventCard } from './EventCard'
import { PostCard } from './PostCard'
import { EmptyState } from './EmptyState'

interface SavedItemsProps {
  profileId: string
  savedItems: ReturnType<typeof useSavedItems>
}

// Módulo 7 — SALVOS. Destino próprio: reaproveita ContentCard / EventCard
// / PostCard sem nenhuma alteração de comportamento além do botão de
// salvar que os três já ganharam. Curtir/RSVP/reagir ficam desligados
// aqui de propósito (canLike/canRsvp/canInteract = false) — essas ações
// continuam só na tela de origem de cada item (Biblioteca/Eventos/Feed);
// a única ação nova desta tela é "Remover dos salvos". Contagens
// (curtidas, confirmadas, reações, comentários) são as reais, vindas do
// próprio useSavedItems — nada inventado.
export function SavedItems({ profileId, savedItems }: SavedItemsProps) {
  const {
    rows,
    contentItems,
    postItems,
    eventItems,
    postReactionCounts,
    postReactedIds,
    postCommentCounts,
    postCommentsByPost,
    loading,
    error,
    toggleSave,
    fetchPostComments,
  } = savedItems

  const isEmpty = !loading && !error && rows.length === 0

  function postCardProps(post: Post) {
    return {
      post,
      reactionCount: postReactionCounts[post.id] ?? 0,
      hasReacted: postReactedIds.has(post.id),
      commentCount: postCommentCounts[post.id] ?? 0,
      comments: postCommentsByPost[post.id],
      canInteract: false,
      onToggleReaction: async () => ({ error: null }),
      onOpenComments: () => fetchPostComments(post.id),
      onAddComment: async () => ({ error: 'Abra a publicação no Feed para comentar.' }),
      isSaved: true,
      onToggleSave: () => toggleSave('post', post.id, true),
    }
  }

  return (
    <section className="saved-items">
      <p className="section-label">Salvos</p>

      {loading && rows.length === 0 && <p className="home-muted">Carregando salvos...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {isEmpty && (
        <EmptyState message="Você ainda não salvou nada. Toque no marcador em conteúdos, publicações ou eventos para guardá-los aqui." />
      )}

      {contentItems.length > 0 && (
        <div className="saved-items-group">
          <p className="saved-items-group-title">Biblioteca</p>
          <div className="saved-items-list">
            {contentItems.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                profileId={profileId}
                canLike={false}
                onToggleLike={async () => ({ error: null })}
                isSaved
                onToggleSave={() => toggleSave('content', item.id, true)}
              />
            ))}
          </div>
        </div>
      )}

      {eventItems.length > 0 && (
        <div className="saved-items-group">
          <p className="saved-items-group-title">Eventos</p>
          <div className="saved-items-list">
            {eventItems.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                profileId={profileId}
                canRsvp={false}
                onRsvp={async () => ({ error: null })}
                onCancelRsvp={async () => ({ error: null })}
                isSaved
                onToggleSave={() => toggleSave('event', event.id, true)}
              />
            ))}
          </div>
        </div>
      )}

      {postItems.length > 0 && (
        <div className="saved-items-group">
          <p className="saved-items-group-title">Publicações</p>
          <div className="saved-items-list">
            {postItems.map((post) => (
              <PostCard key={post.id} {...postCardProps(post)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
