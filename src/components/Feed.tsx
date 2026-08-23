import { usePosts } from '../hooks/usePosts'
import { PostComposer } from './PostComposer'
import { PostCard } from './PostCard'

interface FeedProps {
  communityId: string
  authorId: string
  canPost: boolean
}

export function Feed({ communityId, authorId, canPost }: FeedProps) {
  const { posts, loading, error, createPost } = usePosts(communityId)

  return (
    <div className="feed">
      {canPost && <PostComposer onPublish={(content) => createPost(authorId, content)} />}

      {loading && <p>Carregando publicações...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p className="feed-empty">Ainda não há publicações nesta comunidade.</p>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
