import { useState } from 'react'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { Comment, CreateCommentResult, Post, ToggleReactionResult } from '../types/post'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'

interface PostCardProps {
  post: Post
  reactionCount: number
  hasReacted: boolean
  commentCount: number
  comments: Comment[] | undefined
  canInteract: boolean
  onToggleReaction: () => Promise<ToggleReactionResult>
  onOpenComments: () => Promise<CreateCommentResult>
  onAddComment: (content: string) => Promise<CreateCommentResult>
}

export function PostCard({
  post,
  reactionCount,
  hasReacted,
  commentCount,
  comments,
  canInteract,
  onToggleReaction,
  onOpenComments,
  onAddComment,
}: PostCardProps) {
  const name = post.author?.full_name ?? 'Participante'
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [reacting, setReacting] = useState(false)

  async function handleToggleComments() {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)

    if (nextOpen && comments === undefined) {
      setLoadingComments(true)
      await onOpenComments()
      setLoadingComments(false)
    }
  }

  async function handleToggleReaction() {
    if (!canInteract || reacting) return
    setReacting(true)
    await onToggleReaction()
    setReacting(false)
  }

  const isDailyQuestion = post.post_type === 'daily_question'

  return (
    <article className={`post-card${isDailyQuestion ? ' post-card--question' : ''}`}>
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

      {isDailyQuestion && <span className="post-badge">Pergunta do dia</span>}

      <p className="post-content">{post.content}</p>

      <div className="post-actions">
        <button
          type="button"
          className={`post-reaction${hasReacted ? ' post-reaction--active' : ''}`}
          onClick={handleToggleReaction}
          disabled={!canInteract || reacting}
        >
          {hasReacted ? '❤️' : '♡'} {reactionCount}
        </button>

        <button type="button" className="post-comment-toggle" onClick={handleToggleComments}>
          💬 {commentCount}
        </button>
      </div>

      {commentsOpen && (
        <div className="post-comments">
          {loadingComments && <p>Carregando comentários...</p>}

          {!loadingComments && <CommentList comments={comments ?? []} />}

          {canInteract && <CommentForm onSubmit={onAddComment} />}
        </div>
      )}
    </article>
  )
}
