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
  /** Tocar na foto ou no nome abre o perfil de quem comentou. */
  onOpenAuthor?: (profileId: string) => void
}

/**
 * Linha visual de um comentário — avatar + autora + tempo + conteúdo.
 * Compartilhada por CommentList (leitura) e CommentThread (interativo)
 * para não duplicar a marcação.
 */
export function CommentRow({ comment, variant = 'root', onOpenAuthor }: CommentRowProps) {
  const name = comment.author?.full_name ?? 'Participante'
  const authorId = comment.author?.id
  const open = onOpenAuthor && authorId ? () => onOpenAuthor(authorId) : null
  const avatar = comment.author?.avatar_url ? (
    <img loading="lazy" decoding="async" src={comment.author.avatar_url} alt="" />
  ) : (
    <span>{name.charAt(0).toUpperCase()}</span>
  )
  const { url: imageUrl } = useSignedImageUrl(comment.image_url ?? null)
  const likes = useCommentLikesContext()
  const liked = !!comment.id && !!likes?.mine.has(comment.id)
  const count = comment.id ? (likes?.counts[comment.id] ?? 0) : 0

  return (
    <div className={`comment-item comment-item--${variant}`}>
      {open ? (
        <button
          type="button"
          className="comment-avatar comment-avatar--open"
          onClick={open}
          aria-label={`Ver o perfil de ${name}`}
        >
          {avatar}
        </button>
      ) : (
        <div className="comment-avatar" aria-hidden="true">
          {avatar}
        </div>
      )}
      <div className="comment-item-main">
        <p className="comment-author">
          {open ? (
            <button type="button" className="comment-author-open" onClick={open}>
              {name}
            </button>
          ) : (
            name
          )}{' '}
          <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
        </p>
        {!(comment.image_url && comment.content.trim() === '📷') && (
          <p className="comment-content">{comment.content}</p>
        )}
        {imageUrl && (
          <img
            className="comment-image"
            src={imageUrl}
            alt=""
            loading="lazy"
            onClick={() => window.open(imageUrl, '_blank', 'noopener')}
          />
        )}
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
