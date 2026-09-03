import { formatRelativeTime } from '../lib/formatRelativeTime'

export interface CommentRowData {
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

  return (
    <div className={`comment-item comment-item--${variant}`}>
      <div className="comment-avatar" aria-hidden="true">
        {comment.author?.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="comment-item-main">
        <p className="comment-author">
          {name} <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
        </p>
        <p className="comment-content">{comment.content}</p>
      </div>
    </div>
  )
}
