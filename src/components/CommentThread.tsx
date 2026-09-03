import { useState } from 'react'
import type { Comment, CreateCommentResult } from '../types/post'
import { CommentRow } from './CommentRow'
import { CommentForm } from './CommentForm'
import { ReplyIcon } from './icons'

/** Respostas mostradas antes de "Ver mais respostas" (árvore já carregada). */
const REPLIES_VISIBLE = 2

interface CommentThreadProps {
  comment: Comment
  canInteract: boolean
  /** Envia uma resposta a ESTE comentário-raiz. Sem isso, some "Responder". */
  onReply?: (content: string, parentCommentId: string) => Promise<CreateCommentResult>
  /** Preview do Feed: nº de respostas conhecido antes de carregar a árvore. */
  replyCountHint?: number
  /** Preview do Feed: carrega a conversa inteira deste post. */
  onExpand?: () => void
}

export function CommentThread({
  comment,
  canInteract,
  onReply,
  replyCountHint = 0,
  onExpand,
}: CommentThreadProps) {
  const [replying, setReplying] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)

  const replies = comment.replies ?? []
  const loadedReplyCount = replies.length
  // no preview a árvore não veio: usamos a contagem conhecida
  const knownReplyCount = loadedReplyCount > 0 ? loadedReplyCount : replyCountHint

  const visibleReplies = showAllReplies ? replies : replies.slice(0, REPLIES_VISIBLE)
  const hiddenLoaded = loadedReplyCount - visibleReplies.length

  async function handleReplySubmit(content: string): Promise<CreateCommentResult> {
    if (!onReply) return { error: 'Não é possível responder aqui.' }
    return onReply(content, comment.id)
  }

  const canReply = canInteract && !!onReply
  const showPreviewRepliesLink = loadedReplyCount === 0 && knownReplyCount > 0 && !!onExpand

  return (
    <li className="comment-thread">
      <CommentRow comment={comment} variant="root" />

      {(canReply || showPreviewRepliesLink) && (
        <div className="comment-thread-actions">
          {canReply && (
            <button
              type="button"
              className="comment-reply-action"
              onClick={() => setReplying((value) => !value)}
            >
              <ReplyIcon size={13} /> Responder
            </button>
          )}
          {showPreviewRepliesLink && (
            <button type="button" className="comment-reply-action" onClick={onExpand}>
              <ReplyIcon size={13} /> Ver {knownReplyCount}{' '}
              {knownReplyCount === 1 ? 'resposta' : 'respostas'}
            </button>
          )}
        </div>
      )}

      {replying && (
        <div className="comment-reply-form-wrap">
          <CommentForm
            onSubmit={handleReplySubmit}
            onCancel={() => setReplying(false)}
            placeholder={`Responder a ${comment.author?.full_name ?? 'este comentário'}...`}
            submitLabel="Responder"
            autoFocus
            variant="reply"
          />
        </div>
      )}

      {visibleReplies.length > 0 && (
        <ul className="comment-replies">
          {visibleReplies.map((reply) => (
            <li key={reply.id}>
              <CommentRow comment={reply} variant="reply" />
            </li>
          ))}
        </ul>
      )}

      {hiddenLoaded > 0 && (
        <button
          type="button"
          className="comment-reply-more"
          onClick={() => setShowAllReplies(true)}
        >
          Ver mais {hiddenLoaded} {hiddenLoaded === 1 ? 'resposta' : 'respostas'}
        </button>
      )}
    </li>
  )
}
