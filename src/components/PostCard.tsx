import type { Post } from '../types/post'

interface PostCardProps {
  post: Post
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`

  return new Date(iso).toLocaleDateString('pt-BR')
}

export function PostCard({ post }: PostCardProps) {
  const name = post.author?.full_name ?? 'Participante'

  return (
    <article className="post-card">
      <div className="post-card-header">
        <div className="post-avatar" aria-hidden="true">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className="post-author">{name}</p>
          <p className="post-time">{formatRelativeTime(post.created_at)}</p>
        </div>
      </div>
      <p className="post-content">{post.content}</p>
    </article>
  )
}
