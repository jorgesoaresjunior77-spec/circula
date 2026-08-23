import { formatRelativeTime } from '../lib/formatRelativeTime'

export interface CommentLike {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface CommentListProps {
  comments: CommentLike[]
}

export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="comment-empty">Ainda não há comentários. Seja a primeira a comentar!</p>
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => {
        const name = comment.author?.full_name ?? 'Participante'

        return (
          <li key={comment.id} className="comment-item">
            <div className="comment-avatar" aria-hidden="true">
              {comment.author?.avatar_url ? (
                <img src={comment.author.avatar_url} alt="" />
              ) : (
                <span>{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="comment-author">
                {name} <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
              </p>
              <p className="comment-content">{comment.content}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
