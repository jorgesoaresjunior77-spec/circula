import { useState } from 'react'
import { usePostsModeration } from '../hooks/usePostsModeration'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { ModerationPost } from '../types/panel'
import { HeartIcon, CommentIcon } from './icons'
import { EmptyState } from './EmptyState'

interface PostsModerationPanelProps {
  communityId: string
}

const POST_TYPE_LABEL: Record<string, string> = {
  standard: 'Publicação',
  daily_question: 'Pergunta do dia',
  checkin_share: 'Check-in',
  engagement_command: 'Comando da comunidade',
}

function ModerationRow({
  post,
  onModerate,
}: {
  post: ModerationPost
  onModerate: (action: 'hide' | 'unhide' | 'remove') => Promise<{ error: string | null }>
}) {
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hidden = post.hidden_at !== null
  const name = post.author_name ?? 'Participante'

  async function run(action: 'hide' | 'unhide' | 'remove') {
    setBusy(true)
    setError(null)
    const { error: actionError } = await onModerate(action)
    setBusy(false)
    if (actionError) {
      setError(actionError)
      return
    }
    setConfirmRemove(false)
  }

  return (
    <article className={`moderation-post${hidden ? ' moderation-post--hidden' : ''}`}>
      <div className="moderation-post-head">
        <div className="moderation-post-avatar" aria-hidden="true">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="moderation-post-meta">
          <p className="moderation-post-author">{name}</p>
          <p className="moderation-post-time">
            {POST_TYPE_LABEL[post.post_type] ?? 'Publicação'} · {formatRelativeTime(post.created_at)}
            {post.circle_id ? ' · em um círculo' : ''}
          </p>
        </div>
        <span
          className={`moderation-post-state${hidden ? ' moderation-post-state--hidden' : ''}`}
        >
          {hidden ? 'Oculta' : 'Visível'}
        </span>
      </div>

      {post.title && <p className="moderation-post-title">{post.title}</p>}
      <p className="moderation-post-content">{post.content}</p>
      {post.image_url && (
        <img className="moderation-post-image" src={post.image_url} alt="" loading="lazy" />
      )}

      <p className="moderation-post-stats">
        <span>
          <HeartIcon size={14} /> {post.reaction_count}
        </span>
        <span>
          <CommentIcon size={14} /> {post.comment_count}
        </span>
      </p>

      {error && <p className="auth-error">{error}</p>}

      <div className="moderation-post-actions">
        {hidden ? (
          <button type="button" onClick={() => run('unhide')} disabled={busy}>
            Reexibir
          </button>
        ) : (
          <button type="button" onClick={() => run('hide')} disabled={busy}>
            Ocultar
          </button>
        )}

        {confirmRemove ? (
          <>
            <button
              type="button"
              className="moderation-post-remove"
              onClick={() => run('remove')}
              disabled={busy}
            >
              Confirmar remoção definitiva
            </button>
            <button type="button" className="auth-link" onClick={() => setConfirmRemove(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="moderation-post-remove"
            onClick={() => setConfirmRemove(true)}
            disabled={busy}
          >
            Remover
          </button>
        )}
      </div>
    </article>
  )
}

/**
 * Aba "Publicações" do painel da Nutri: administração/moderação das
 * publicações da PRÓPRIA comunidade. Lista tudo (inclusive o que já foi
 * ocultado). Ações via RPC `moderate_post` — nunca DELETE direto. A
 * leitura normal do Feed (Feed.tsx / usePosts.ts) não é tocada.
 */
export function PostsModerationPanel({ communityId }: PostsModerationPanelProps) {
  const { posts, loading, error, moderate } = usePostsModeration(communityId)

  if (loading) return <p className="home-muted">Carregando publicações...</p>
  if (error) return <p className="auth-error">Não foi possível carregar as publicações agora.</p>
  if (posts.length === 0) {
    return <EmptyState message="Ainda não há publicações nesta comunidade." />
  }

  const hiddenCount = posts.filter((post) => post.hidden_at !== null).length

  return (
    <div className="moderation-panel">
      <p className="challenge-field-hint">
        {posts.length} publicaç{posts.length === 1 ? 'ão' : 'ões'}
        {hiddenCount > 0 ? ` · ${hiddenCount} oculta${hiddenCount === 1 ? '' : 's'}` : ''}. Ocultar
        tira a publicação do Feed das participantes; remover apaga em definitivo.
      </p>
      {posts.map((post) => (
        <ModerationRow
          key={post.id}
          post={post}
          onModerate={(action) => moderate(post.id, action)}
        />
      ))}
    </div>
  )
}
