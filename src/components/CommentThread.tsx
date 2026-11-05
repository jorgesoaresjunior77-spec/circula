import { useState } from 'react'
import type { Comment, CreateCommentResult } from '../types/post'
import { CommentRow } from './CommentRow'
import { CommentForm } from './CommentForm'
import { ReplyIcon } from './icons'

interface CommentThreadProps {
  comment: Comment
  canInteract: boolean
  /** Envia uma resposta a ESTE comentário-raiz. Sem isso, some "Responder". */
  onReply?: (
    content: string,
    parentCommentId: string,
    imageFile?: File | null,
  ) => Promise<CreateCommentResult>
}

export function CommentThread({ comment, canInteract, onReply }: CommentThreadProps) {
  const [replying, setReplying] = useState(false)
  // Resposta a uma resposta: fica agrupada sob o comentário-raiz, com @nome.
  const [replyingToReply, setReplyingToReply] = useState<string | null>(null)
  const [showAllReplies, setShowAllReplies] = useState(false)

  // As respostas vêm fechadas, com aviso "Ver N respostas"; ao responder, abrem.
  const replies = comment.replies ?? []
  const replyCount = replies.length
  const visibleReplies = showAllReplies ? replies : []

  async function handleReplySubmit(
    content: string,
    file?: File | null,
  ): Promise<CreateCommentResult> {
    if (!onReply) return { error: 'Não é possível responder aqui.' }
    const result = await onReply(content, comment.id, file)
    if (!result.error) setShowAllReplies(true)
    return result
  }

  async function handleReplyToReply(
    name: string,
    content: string,
    file?: File | null,
  ): Promise<CreateCommentResult> {
    if (!onReply) return { error: 'Não é possível responder aqui.' }
    const result = await onReply(`@${name} ${content}`, comment.id, file)
    if (!result.error) setShowAllReplies(true)
    return result
  }

  const canReply = canInteract && !!onReply
  const repliesLabel = `${replyCount} ${replyCount === 1 ? 'resposta' : 'respostas'}`

  return (
    <li className="comment-thread">
      <CommentRow comment={comment} variant="root" />

      {(canReply || replyCount > 0) && (
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
          {replyCount > 0 && (
            <button
              type="button"
              className="comment-reply-action"
              aria-expanded={showAllReplies}
              onClick={() => setShowAllReplies((value) => !value)}
            >
              <ReplyIcon size={13} /> {showAllReplies ? 'Ocultar respostas' : `Ver ${repliesLabel}`}
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
              {canReply && (
                <button
                  type="button"
                  className="comment-reply-action"
                  onClick={() => setReplyingToReply((v) => (v === reply.id ? null : reply.id))}
                >
                  <ReplyIcon size={13} /> Responder
                </button>
              )}
              {replyingToReply === reply.id && (
                <div className="comment-reply-form-wrap">
                  <CommentForm
                    onSubmit={(text, file) =>
                      handleReplyToReply(reply.author?.full_name ?? 'Participante', text, file)
                    }
                    onCancel={() => setReplyingToReply(null)}
                    placeholder={`Responder a ${reply.author?.full_name ?? 'esta resposta'}...`}
                    submitLabel="Responder"
                    autoFocus
                    variant="reply"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

    </li>
  )
}
