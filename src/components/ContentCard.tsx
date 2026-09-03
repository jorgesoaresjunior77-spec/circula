import { useState } from 'react'
import type { CommunityContent } from '../types/content'
import { CONTENT_TYPE_LABEL } from '../types/content'
import { HeartIcon, BookmarkIcon } from './icons'
import { formatRelativeTime } from '../lib/formatRelativeTime'

interface ContentCardProps {
  item: CommunityContent
  profileId: string
  circleName?: string | null
  canLike: boolean
  onToggleLike: (liked: boolean) => Promise<{ error: string | null }>
  /** Quando definido, mostra o botão de salvar (Módulo 7). */
  isSaved?: boolean
  onToggleSave?: (saved: boolean) => Promise<{ error: string | null }>
}

export function ContentCard({
  item,
  profileId,
  circleName,
  canLike,
  onToggleLike,
  isSaved,
  onToggleSave,
}: ContentCardProps) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)

  const liked = item.likes.some((like) => like.profile_id === profileId)
  const likeCount = item.likes.length

  async function handleLike() {
    setWorking(true)
    await onToggleLike(liked)
    setWorking(false)
  }

  async function handleSave() {
    if (!onToggleSave) return
    setSavingBookmark(true)
    await onToggleSave(!!isSaved)
    setSavingBookmark(false)
  }

  return (
    <article className="content-card">
      {item.cover_image_url && (
        <div className="content-card-cover" aria-hidden="true">
          <img src={item.cover_image_url} alt="" />
        </div>
      )}

      <div className="content-card-body">
        <div className="content-card-badges">
          <span className="content-card-type">{CONTENT_TYPE_LABEL[item.type]}</span>
          {item.category && <span className="content-card-tag">{item.category}</span>}
          {circleName && <span className="content-card-tag">Círculo: {circleName}</span>}
          {item.status !== 'published' && (
            <span className="content-card-tag">
              {item.status === 'draft' ? 'Rascunho' : 'Arquivado'}
            </span>
          )}
        </div>

        <h3 className="content-card-title">{item.title}</h3>

        {item.summary && <p className="content-card-summary">{item.summary}</p>}

        <p className="content-card-meta">
          {item.author?.full_name ?? 'Equipe da comunidade'} · {formatRelativeTime(item.created_at)}
        </p>

        {open && item.body && <div className="content-card-full">{item.body}</div>}

        <div className="content-card-actions">
          {item.body && (
            <button
              type="button"
              className="content-card-read"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? 'Fechar' : 'Ler'}
            </button>
          )}
          {item.external_url && (
            <a
              className="content-card-read"
              href={item.external_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir
            </a>
          )}
          {canLike && (
            <button
              type="button"
              className={`content-card-like${liked ? ' content-card-like--on' : ''}`}
              onClick={handleLike}
              disabled={working}
              aria-pressed={liked}
            >
              <HeartIcon size={15} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
          )}
          {!canLike && likeCount > 0 && (
            <span className="content-card-like">
              <HeartIcon size={15} />
              <span>{likeCount}</span>
            </span>
          )}
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
      </div>
    </article>
  )
}
