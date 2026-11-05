import { formatRelativeTime } from '../lib/formatRelativeTime'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useCommentLikesContext } from '../hooks/useCommentLikes'

export interface CommentRowData {
  id?: string
  image_url?: string | null
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface CommentRowProps {
  comment: CommentRowData
  /** 'root' = comentário-raiz (avatar maior). 'reply' = resposta agrupada. */
  variant?: 'root' | 'reply'
}

/**
 * Linha visual de um comentário — avatar + autora + tempo + conteúdo.
 * Compartilhada por CommentList (leitura) e CommentThread (interativo)
 * para não duplicar a marcação.
 */
export function CommentRow({ comment, variant = 'root' }: CommentRowProps) {
  const name = comment.author?.full_name ?? 'Participante'
  const { url: imageUrl } = useSignedImageUrl(comment.image_url ?? null)
  const likes = useCommentLikesContext()
  const liked = !!comment.id && !!likes?.mine.has(comment.id)
  const count = comment.id ? (likes?.counts[comment.id] ?? 0) : 0

  return (
    <div className={`comment-item comment-item--${variant}`}>
      <div className="comment-avatar" aria-hidden="true">
        {comment.author?.avatar_url ? (
          <img loading="lazy" decoding="async" src={comment.author.avatar_url} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="comment-item-main">
        <p className="comment-author">
          {name} <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
        </p>
        {!(comment.image_url && comment.content.trim() === '📷') && (
          <p className="comment-content">{comment.content}</p>
        )}
        {imageUrl && <img className="comment-image" src={imageUrl} alt="" loading="lazy" />}
        {likes && comment.id && (
          <button
            type="button"
            className={`comment-like${liked ? ' comment-like--on' : ''}`}
            onClick={() => likes.toggle(comment.id as string)}
            aria-pressed={liked}
          >
            {liked ? '♥' : '♡'} {count > 0 ? count : ''}
          </button>
        )}
      </div>
    </div>
  )
}
