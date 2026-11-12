import { useState } from 'react'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { Comment, CreateCommentResult, Post, ToggleReactionResult } from '../types/post'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CommentList } from './CommentList'
import { CommentThread } from './CommentThread'
import { CommentLikesContext, useCommentLikes } from '../hooks/useCommentLikes'
import { uploadCommunityMedia } from '../lib/communityMedia'
import { CommentForm } from './CommentForm'
import { HeartIcon, CommentIcon, BookmarkIcon } from './icons'
import { GardenDailyPostCard } from './GardenDailyPostCard'
import { GardenShareCard } from './GardenShareCard'

interface PostCardProps {
  /** Abre o perfil de quem publicou (toque na foto ou no nome). */
  onOpenAuthor?: (profileId: string) => void
  post: Post
  reactionCount: number
  hasReacted: boolean
  commentCount: number
  comments: Comment[] | undefined
  canInteract: boolean
  onToggleReaction: () => Promise<ToggleReactionResult>
  onOpenComments: () => Promise<CreateCommentResult>
  onAddComment: (
    content: string,
    parentCommentId?: string | null,
    imageUrl?: string | null,
  ) => Promise<CreateCommentResult>
  /** Quem está vendo (curtidas e envio de imagem nas respostas). */
  viewerId?: string
  /** Quando definido, mostra o botão de salvar (Módulo 7). */
  isSaved?: boolean
  onToggleSave?: (saved: boolean) => Promise<{ error: string | null }>
  /**
   * Feed de Conversa: os comentários ficam no próprio card, FECHADOS, com
   * um aviso ("Ver 3 comentários e 2 respostas") para abrir; abertos, trazem
   * as respostas (também fechadas, com aviso) e o campo para comentar. Sem
   * isso, comportamento clássico (usado pela Home): a seção de comentários
   * abre/fecha no botão de comentários.
   */
  inlineConversation?: boolean
  /** Nº de comentários-raiz (os demais, até commentCount, são respostas). */
  topLevelCount?: number
  /**
   * D3 — "Publicações recentes" da Home: no desktop, a foto fica ao
   * lado do texto (não embaixo), inteira (object-fit: contain, sem
   * corte) em vez de preencher um recorte. Só CSS (grid) — a ordem no
   * DOM não muda, então no mobile continua empilhado normalmente
   * (avatar+nome → texto → foto). Demais usos de PostCard (Feed,
   * editorial) não passam essa prop e ficam exatamente como estão.
   */
  mediaAside?: boolean
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
  viewerId,
  isSaved,
  onToggleSave,
  inlineConversation = false,
  topLevelCount = 0,
  mediaAside = false,
  onOpenAuthor,
}: PostCardProps) {
  const name = post.author?.full_name ?? 'Participante'
  const { url: postImageUrl } = useSignedImageUrl(post.image_url)
  const [commentsOpen, setCommentsOpen] = useState(false)
  // Feed de Conversa: conversa (comentários + respostas) aberta ou fechada.
  const [threadOpen, setThreadOpen] = useState(false)
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

  async function openThread() {
    setThreadOpen(true)
    await loadFullThread()
  }

  async function handleCommentButton() {
    if (inlineConversation) {
      if (threadOpen) setThreadOpen(false)
      else await openThread()
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

  // Envia o comentário/resposta; se houver foto, sobe para o bucket antes.
  async function submitComment(
    content: string,
    parentCommentId: string | null,
    file?: File | null,
  ): Promise<CreateCommentResult> {
    let imagePath: string | null = null
    if (file) {
      if (!viewerId) return { error: 'Sem sessão ativa.' }
      const up = await uploadCommunityMedia(file, post.community_id, viewerId, 'posts')
      if (up.error || !up.path) return { error: up.error ?? 'Falha no envio da imagem.' }
      imagePath = up.path
    }
    return onAddComment(content, parentCommentId, imagePath)
  }

  const handleReply = (content: string, parentCommentId: string, file?: File | null) =>
    submitComment(content, parentCommentId, file)

  const visibleComments: Comment[] = (comments ?? []).flatMap((c) => [c, ...(c.replies ?? [])])
  const commentLikes = useCommentLikes(
    visibleComments.map((c) => c.id),
    viewerId ?? null,
  )

  const isDailyQuestion = post.post_type === 'daily_question'
  const isCheckinShare = post.post_type === 'checkin_share'
  const isEngagementCommand = post.post_type === 'engagement_command'
  // Meu Jardim — card editorial próprio (seção abaixo), não o
  // post-content padrão. Cai de volta no padrão (texto simples) se o
  // post não tiver a linha companheira (garden_daily_post/garden_share)
  // carregada — mesma tolerância já usada por daily_question/
  // engagement_command para posts "órfãos".
  const isGardenDaily = post.post_type === 'garden_daily' && !!post.garden_daily_post
  const isGardenShare = post.post_type === 'garden_share' && !!post.garden_share
  const cardVariant = isDailyQuestion
    ? ' post-card--question'
    : isCheckinShare
      ? ' post-card--checkin'
      : isEngagementCommand
        ? ' post-card--command'
        : isGardenDaily || isGardenShare
          ? ' post-card--garden'
          : ''
  // Composição editorial do Feed de Conversa (redesign). A Home e demais
  // usos clássicos (HomeHighlights) não passam inlineConversation e
  // continuam com a apresentação de card de sempre — nada muda para eles.
  const editorialVariant = inlineConversation ? ' post-card--editorial' : ''
  const mediaAsideVariant = mediaAside ? ' post-card--media-aside' : ''

  const showClassicComments = !inlineConversation && commentsOpen
  const replyTotal = Math.max(0, commentCount - topLevelCount)
  const commentsNotice =
    topLevelCount > 0 && replyTotal > 0
      ? `Ver ${topLevelCount} ${topLevelCount === 1 ? 'comentário' : 'comentários'} e ${replyTotal} ${replyTotal === 1 ? 'resposta' : 'respostas'}`
      : `Ver ${commentCount} ${commentCount === 1 ? 'comentário' : 'comentários'}`

  return (
    <article className={`post-card${cardVariant}${editorialVariant}${mediaAsideVariant}`}>
      <div className="post-card-body">
      <div className="post-card-header">
        {onOpenAuthor ? (
          <button
            type="button"
            className="post-avatar post-avatar--open"
            onClick={() => onOpenAuthor(post.author_id)}
            aria-label={`Ver o perfil de ${name}`}
          >
            {post.author?.avatar_url ? (
              <img loading="lazy" decoding="async" src={post.author.avatar_url} alt="" />
            ) : (
              <span>{name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        ) : (
          <div className="post-avatar" aria-hidden="true">
            {post.author?.avatar_url ? (
              <img loading="lazy" decoding="async" src={post.author.avatar_url} alt="" />
            ) : (
              <span>{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        )}
        <div>
          <p className="post-author">
            {onOpenAuthor ? (
              <button type="button" className="post-author-open" onClick={() => onOpenAuthor(post.author_id)}>
                {name}
              </button>
            ) : (
              name
            )}
          </p>
          <p className="post-time">{formatRelativeTime(post.created_at)}</p>
        </div>
      </div>

      {isDailyQuestion && <span className="post-badge">Pergunta do dia</span>}
      {isCheckinShare && <span className="post-badge post-badge--checkin">Check-in</span>}
      {isEngagementCommand && (
        <span className="post-badge post-badge--command">Comando da comunidade</span>
      )}

      {isEngagementCommand && post.title && <p className="post-title">{post.title}</p>}

      {isGardenDaily && post.garden_daily_post ? (
        <GardenDailyPostCard summary={post.garden_daily_post} />
      ) : isGardenShare && post.garden_share ? (
        <GardenShareCard share={post.garden_share} content={post.content} />
      ) : (
        <p className="post-content">{post.content}</p>
      )}

      {!mediaAside && postImageUrl && (
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

      <CommentLikesContext.Provider value={commentLikes}>
      {inlineConversation && (
        <div className="post-conversation">
          {!threadOpen ? (
            commentCount > 0 || canInteract ? (
              <button
                type="button"
                className="comment-more"
                aria-expanded={false}
                onClick={() => void openThread()}
              >
                <CommentIcon size={15} /> {commentCount > 0 ? commentsNotice : 'Comentar'}
              </button>
            ) : (
              <p className="comment-empty">Ainda não há comentários.</p>
            )
          ) : (
            <>
              {loadingComments && <p className="comment-loading">Carregando conversa...</p>}

              {expanded &&
                ((comments ?? []).length > 0 ? (
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
                      Ainda não há comentários. Seja a primeira a comentar!
                    </p>
                  )
                ))}

              {canInteract && (
                <CommentForm onSubmit={(text, file) => submitComment(text, null, file)} />
              )}

              <button
                type="button"
                className="comment-more comment-more--close"
                aria-expanded={true}
                onClick={() => setThreadOpen(false)}
              >
                Ocultar comentários
              </button>
            </>
          )}
        </div>
      )}

      {showClassicComments && (
        <div className="post-comments">
          {loadingComments && <p>Carregando comentários...</p>}

          {!loadingComments && <CommentList comments={comments ?? []} />}

          {canInteract && <CommentForm onSubmit={(text, file) => submitComment(text, null, file)} />}
        </div>
      )}
      </CommentLikesContext.Provider>
      </div>

      {mediaAside && postImageUrl && (
        <img className="post-image" src={postImageUrl} alt="" loading="lazy" />
      )}
    </article>
  )
}
