import { CommentRow } from './CommentRow'

export interface CommentLike {
  id: string
  content: string
  created_at: string
  parent_comment_id?: string | null
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  /** Respostas agrupadas (quando a fonte monta a árvore). */
  replies?: CommentLike[]
}

interface CommentListProps {
  comments: CommentLike[]
}

/**
 * Lista de comentários somente-leitura. Usada por PostCard (modo
 * clássico da Home), SavedItems, ChallengeCard e HelpRequestCard.
 * Quando um item traz `replies`, elas aparecem agrupadas e recuadas —
 * fontes sem árvore (desafios, pedidos de ajuda) continuam planas.
 */
export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="comment-empty">Ainda não há comentários. Seja a primeira a comentar!</p>
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentRow comment={comment} />
          {comment.replies && comment.replies.length > 0 && (
            <ul className="comment-list comment-list--replies">
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <CommentRow comment={reply} variant="reply" />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
