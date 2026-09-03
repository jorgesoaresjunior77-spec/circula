import { useState } from 'react'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { Comment, CreateCommentResult, Post, ToggleReactionResult } from '../types/post'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'
import { HeartIcon, CommentIcon, BookmarkIcon } from './icons'

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
  /** Quando definido, mostra o botão de salvar (Módulo 7). */
  isSaved?: boolean
  onToggleSave?: (saved: boolean) => Promise<{ error: string | null }>
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
  isSaved,
  onToggleSave,
}: PostCardProps) {
  const name = post.author?.full_name ?? 'Participante'
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)

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

  async function handleSave() {
    if (!onToggleSave) return
    setSavingBookmark(true)
    await onToggleSave(!!isSaved)
    setSavingBookmark(false)
  }

  const isDailyQuestion = post.post_type === 'daily_question'
  const isCheckinShare = post.post_type === 'checkin_share'
  const isEngagementCommand = post.post_type === 'engagement_command'
  const cardVariant = isDailyQuestion
    ? ' post-card--question'
    : isCheckinShare
      ? ' post-card--checkin'
      : isEngagementCommand
        ? ' post-card--command'
        : ''

  return (
    <article className={`post-card${cardVariant}`}>
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
      {isCheckinShare && <span className="post-badge post-badge--checkin">Check-in</span>}
      {isEngagementCommand && (
        <span className="post-badge post-badge--command">Comando da comunidade</span>
      )}

      {isEngagementCommand && post.title && <p className="post-title">{post.title}</p>}
      <p className="post-content">{post.content}</p>

      {post.image_url && (
        <img className="post-image" src={post.image_url} alt="" loading="lazy" />
      )}

      <div className="post-actions">
        <button
          type="button"
          className={`post-reaction${hasReacted ? ' post-reaction--active' : ''}`}
          onClick={handleToggleReaction}
          disabled={!canInteract || reacting}
        >
          <HeartIcon /> {reactionCount}
        </button>

        <button type="button" className="post-comment-toggle" onClick={handleToggleComments}>
          <CommentIcon /> {commentCount}
        </button>

        {onToggleSave && (
          <button
            type="button"
            className={`save-button${isSaved ? ' save-button--on' : ''}`}
            onClick={handleSave}
            disabled={savingBookmark}
            aria-pressed={!!isSaved}
          >
            <BookmarkIcon size={15} />
            {isSaved ? 'Salvo' : 'Salvar'}
          </button>
        )}
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
