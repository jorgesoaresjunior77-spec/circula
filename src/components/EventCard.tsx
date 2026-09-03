import { useState } from 'react'
import type { EventWithParticipants, RsvpResult } from '../types/event'
import { formatEventDate, isPastEvent } from '../lib/formatEventDate'
import { BookmarkIcon } from './icons'

interface EventCardProps {
  event: EventWithParticipants
  profileId: string
  /** Nome do círculo vinculado, quando houver. */
  circleName?: string | null
  canRsvp: boolean
  onRsvp: () => Promise<RsvpResult>
  onCancelRsvp: () => Promise<RsvpResult>
  /** Quando definido, mostra o botão de salvar (Módulo 7). */
  isSaved?: boolean
  onToggleSave?: (saved: boolean) => Promise<{ error: string | null }>
}

const AVATAR_LIMIT = 5

export function EventCard({
  event,
  profileId,
  circleName,
  canRsvp,
  onRsvp,
  onCancelRsvp,
  isSaved,
  onToggleSave,
}: EventCardProps) {
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)

  const isAttending = event.participants.some((p) => p.profile_id === profileId)
  const count = event.participants.length
  const isFull = event.capacity != null && count >= event.capacity && !isAttending
  const past = isPastEvent(event.starts_at, event.ends_at)
  const cancelled = event.status === 'cancelled'

  async function handleToggle() {
    setWorking(true)
    setActionError(null)
    const { error } = isAttending ? await onCancelRsvp() : await onRsvp()
    setWorking(false)
    if (error) setActionError('Não foi possível concluir agora. Tente novamente.')
  }

  async function handleSave() {
    if (!onToggleSave) return
    setSavingBookmark(true)
    await onToggleSave(!!isSaved)
    setSavingBookmark(false)
  }

  const shownAvatars = event.participants.slice(0, AVATAR_LIMIT)
  const extra = count - shownAvatars.length

  return (
    <article className={`event-card${past || cancelled ? ' event-card--muted' : ''}`}>
      {event.cover_image_url && (
        <div className="event-card-cover" aria-hidden="true">
          <img src={event.cover_image_url} alt="" />
        </div>
      )}

      <div className="event-card-body">
        <div className="event-card-badges">
          <span className="event-card-when">{formatEventDate(event.starts_at, event.ends_at)}</span>
          {cancelled && <span className="event-card-tag event-card-tag--cancel">Cancelado</span>}
          {!cancelled && past && <span className="event-card-tag">Encerrado</span>}
          {event.status === 'draft' && <span className="event-card-tag">Rascunho</span>}
          {circleName && <span className="event-card-tag">Círculo: {circleName}</span>}
        </div>

        <h3 className="event-card-title">{event.title}</h3>

        {event.description && <p className="event-card-desc">{event.description}</p>}

        <p className="event-card-meta">
          {event.is_online ? (
            <>
              Online
              {isAttending && event.online_url && (
                <>
                  {' · '}
                  <a href={event.online_url} target="_blank" rel="noopener noreferrer">
                    Abrir link
                  </a>
                </>
              )}
            </>
          ) : (
            event.location || 'Local a definir'
          )}
        </p>

        <div className="event-card-people">
          <button
            type="button"
            className="event-card-count"
            onClick={() => setShowList((v) => !v)}
            aria-expanded={showList}
          >
            {count === 0
              ? 'Ninguém confirmou ainda'
              : count === 1
                ? '1 confirmada'
                : `${count} confirmadas`}
            {event.capacity != null && ` / ${event.capacity} vagas`}
          </button>
          {count > 0 && (
            <div className="event-avatars" aria-hidden="true">
              {shownAvatars.map((p) => (
                <span key={p.id} className="event-avatar">
                  {p.profile?.avatar_url ? (
                    <img src={p.profile.avatar_url} alt="" />
                  ) : (
                    <span>{(p.profile?.full_name ?? 'P').charAt(0).toUpperCase()}</span>
                  )}
                </span>
              ))}
              {extra > 0 && <span className="event-avatar event-avatar--more">+{extra}</span>}
            </div>
          )}
        </div>

        {showList && count > 0 && (
          <ul className="event-participant-list">
            {event.participants.map((p) => (
              <li key={p.id}>{p.profile?.full_name ?? 'Participante'}</li>
            ))}
          </ul>
        )}

        <div className="event-card-footer-actions">
          {canRsvp && !cancelled && !past && (
            <button
              type="button"
              className="event-rsvp-button"
              onClick={handleToggle}
              disabled={working || isFull}
            >
              {working
                ? 'Aguarde...'
                : isAttending
                  ? 'Cancelar presença'
                  : isFull
                    ? 'Vagas esgotadas'
                    : 'Confirmar presença'}
            </button>
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
        {actionError && <p className="auth-error">{actionError}</p>}
      </div>
    </article>
  )
}
