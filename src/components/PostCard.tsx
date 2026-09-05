import { useState } from 'react'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { Comment, CreateCommentResult, Post, ToggleReactionResult } from '../types/post'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CommentList } from './CommentList'
import { CommentThread } from './CommentThread'
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
  onAddComment: (content: string, parentCommentId?: string | null) => Promise<CreateCommentResult>
  /** Quando definido, mostra o botão de salvar (Módulo 7). */
  isSaved?: boolean
  onToggleSave?: (saved: boolean) => Promise<{ error: string | null }>
  /**
   * Feed de Conversa: mostra os comentários direto no card (2–3 de
   * preview + "Ver mais comentários" + respostas agrupadas), sem
   * esconder tudo atrás do botão. Sem isso, comportamento clássico
   * (usado pela Home): a seção de comentários abre/fecha no botão 💬.
   */
  inlineConversation?: boolean
  previewComments?: Comment[]
  topLevelCount?: number
  replyCountByComment?: Record<string, number>
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
  inlineConversation = false,
  previewComments = [],
  topLevelCount = 0,
  replyCountByComment = {},
}: PostCardProps) {
  const name = post.author?.full_name ?? 'Participante'
  const { url: postImageUrl } = useSignedImageUrl(post.image_url)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)

  const expanded = comments !== undefined

  async function loadFullThread() {
    if (expanded || loadingComments) return
    setLoadingComments(true)
    await onOpenComments()
    setLoadingComments(false)
  }

  async function handleToggleComments() {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)

    if (nextOpen && comments === undefined) {
      setLoadingComments(true)
      await onOpenComments()
      setLoadingComments(false)
    }
  }

  async function handleCommentButton() {
    if (inlineConversation) {
      await loadFullThread()
    } else {
      await handleToggleComments()
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

  const handleReply = (content: string, parentCommentId: string) =>
    onAddComment(content, parentCommentId)

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

  const showClassicComments = !inlineConversation && commentsOpen
  const remainingThreads = Math.max(0, topLevelCount - previewComments.length)
  const showSeeMore =
    inlineConversation && !expanded && commentCount > previewComments.length

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

      {postImageUrl && (
        <img className="post-image" src={postImageUrl} alt="" loading="lazy" />
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

        <button type="button" className="post-comment-toggle" onClick={handleCommentButton}>
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

      {inlineConversation && (
        <div className="post-conversation">
          {loadingComments && <p className="comment-loading">Carregando conversa...</p>}

          {expanded ? (
            (comments ?? []).length > 0 ? (
              <ul className="comment-thread-list">
                {(comments ?? []).map((thread) => (
                  <CommentThread
                    key={thread.id}
                    comment={thread}
                    canInteract={canInteract}
                    onReply={canInteract ? handleReply : undefined}
                  />
                ))}
              </ul>
            ) : (
              !loadingComments && (
                <p className="comment-empty">
                  Ainda não há comentários. Seja a primeira a comentar! 🌷
                </p>
              )
            )
          ) : (
            <>
              {previewComments.length > 0 ? (
                <ul className="comment-thread-list">
                  {previewComments.map((thread) => (
                    <CommentThread
                      key={thread.id}
                      comment={thread}
                      canInteract={canInteract}
                      onReply={canInteract ? handleReply : undefined}
                      replyCountHint={replyCountByComment[thread.id] ?? 0}
                      onExpand={loadFullThread}
                    />
                  ))}
                </ul>
              ) : (
                <p className="comment-empty">Seja a primeira a comentar 🌷</p>
              )}

              {showSeeMore && (
                <button type="button" className="comment-more" onClick={loadFullThread}>
                  <CommentIcon size={15} /> Ver mais comentários
                  {remainingThreads > 0 ? ` (${remainingThreads})` : ''}
                </button>
              )}
            </>
          )}

          {canInteract && <CommentForm onSubmit={(text) => onAddComment(text, null)} />}
        </div>
      )}

      {showClassicComments && (
        <div className="post-comments">
          {loadingComments && <p>Carregando comentários...</p>}

          {!loadingComments && <CommentList comments={comments ?? []} />}

          {canInteract && <CommentForm onSubmit={(text) => onAddComment(text, null)} />}
        </div>
      )}
    </article>
  )
}
