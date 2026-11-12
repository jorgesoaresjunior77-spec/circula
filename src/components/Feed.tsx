import { usePosts } from '../hooks/usePosts'
import { useSavedPostIds } from '../hooks/useSavedPostIds'
import { PostComposer } from './PostComposer'
import { PostCard } from './PostCard'
import { EmptyState } from './EmptyState'

/**
 * Mensagens principais abertas por vez no Feed de Conversa. Sempre aparecem
 * ao menos 6 (se existirem); as seguintes ficam atrás de "Ver mais mensagens".
 * Comentários e respostas de cada mensagem vêm fechados, com aviso para abrir.
 */
const FEED_PAGE_SIZE = 6

interface FeedProps {
  /** Abre o perfil de quem publicou. */
  onOpenAuthor?: (profileId: string) => void
  communityId: string
  authorId: string
  canPost: boolean
  refreshToken?: number
  /** Quando definido, o feed é de um círculo (não da comunidade). */
  circleId?: string
  /** Nome do círculo — mostrado no compositor quando circleId existe. */
  circleName?: string
  /** Só apresentação: avatar/nome de quem publica, para o convite do composer. */
  authorName?: string | null
  authorAvatarUrl?: string | null
}

export function Feed({
  communityId,
  authorId,
  canPost,
  refreshToken,
  circleId,
  circleName,
  authorName,
  authorAvatarUrl,
  onOpenAuthor,
}: FeedProps) {
  const {
    posts,
    loading,
    error,
    createPost,
    uploadPostImage,
    reactionCounts,
    reactedPostIds,
    commentCounts,
    topLevelCounts,
    commentsByPost,
    toggleReaction,
    fetchComments,
    addComment,
    hasMore,
    loadMore,
    loadingMore,
  } = usePosts(communityId, authorId, refreshToken, circleId ?? null, {
    pageSize: FEED_PAGE_SIZE,
  })

  const { savedPostIds, toggleSavedPost } = useSavedPostIds(authorId)

  const emptyMessage = circleId
    ? 'Ainda não há publicações neste círculo. Seja a primeira a compartilhar algo.'
    : 'Ainda não há publicações nesta comunidade. Seja a primeira a compartilhar algo.'

  return (
    <div className="feed">
      {canPost && (
        <PostComposer
          onPublish={(content, imageUrl) => createPost(authorId, content, imageUrl)}
          onUploadImage={uploadPostImage}
          authorName={authorName}
          authorAvatarUrl={authorAvatarUrl}
          contextLabel={
            circleId
              ? circleName
                ? `Publicando no círculo ${circleName}`
                : 'Publicando neste círculo'
              : undefined
          }
        />
      )}

      {loading && <p>Carregando publicações...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && posts.length === 0 && <EmptyState message={emptyMessage} />}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="feed-list">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                reactionCount={reactionCounts[post.id] ?? 0}
                hasReacted={reactedPostIds.has(post.id)}
                commentCount={commentCounts[post.id] ?? 0}
                comments={commentsByPost[post.id]}
                canInteract={canPost}
                onToggleReaction={() => toggleReaction(post.id, authorId)}
                onOpenComments={() => fetchComments(post.id)}
                onAddComment={(content, parentId, imageUrl) =>
                  addComment(post.id, authorId, content, parentId ?? null, imageUrl ?? null)
                }
                viewerId={authorId}
                inlineConversation
                topLevelCount={topLevelCounts[post.id] ?? 0}
                isSaved={savedPostIds.has(post.id)}
                onToggleSave={(saved) => toggleSavedPost(post.id, saved)}
                onOpenAuthor={onOpenAuthor}
              />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              className="feed-load-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Carregando…' : 'Ver mais mensagens'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
