import { usePosts } from '../hooks/usePosts'
import { PostComposer } from './PostComposer'
import { PostCard } from './PostCard'
import { EmptyState } from './EmptyState'

interface FeedProps {
  communityId: string
  authorId: string
  canPost: boolean
  refreshToken?: number
}

export function Feed({ communityId, authorId, canPost, refreshToken }: FeedProps) {
  const {
    posts,
    loading,
    error,
    createPost,
    reactionCounts,
    reactedPostIds,
    commentCounts,
    commentsByPost,
    toggleReaction,
    fetchComments,
    addComment,
  } = usePosts(communityId, authorId, refreshToken)

  return (
    <div className="feed">
      {canPost && <PostComposer onPublish={(content) => createPost(authorId, content)} />}

      {loading && <p>Carregando publicações...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <EmptyState message="Ainda não há publicações nesta comunidade. Seja a primeira a compartilhar algo." />
      )}

      {!loading && !error && posts.length > 0 && (
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
              onAddComment={(content) => addComment(post.id, authorId, content)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
