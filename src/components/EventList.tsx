import { useMemo, useState } from 'react'
import type { EventWithParticipants } from '../types/event'
import type { CircleWithMembers } from '../types/circle'
import { EventCard } from './EventCard'
import { EmptyState } from './EmptyState'
import { isPastEvent } from '../lib/formatEventDate'

type EventFilter = 'proximos' | 'meus' | 'encerrados'

interface EventListProps {
  events: EventWithParticipants[]
  loading: boolean
  error: string | null
  profileId: string
  circles: CircleWithMembers[]
  canRsvp: boolean
  communityName?: string
  onRsvp: (eventId: string) => Promise<{ error: string | null }>
  onCancelRsvp: (eventId: string) => Promise<{ error: string | null }>
  /** Módulo 7 — ids já salvos pela usuária logada; omitido = botão oculto. */
  savedEventIds?: Set<string>
  onToggleSave?: (eventId: string, saved: boolean) => Promise<{ error: string | null }>
}

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'proximos', label: 'Próximos' },
  { key: 'meus', label: 'Meus eventos' },
  { key: 'encerrados', label: 'Encerrados' },
]

export function EventList({
  events,
  loading,
  error,
  profileId,
  circles,
  canRsvp,
  communityName,
  onRsvp,
  onCancelRsvp,
  savedEventIds,
  onToggleSave,
}: EventListProps) {
  const [filter, setFilter] = useState<EventFilter>('proximos')

  const circleName = useMemo(() => {
    const map = new Map<string, string>()
    for (const circle of circles) map.set(circle.id, circle.name)
    return map
  }, [circles])

  const visible = useMemo(() => {
    const attending = (event: EventWithParticipants) =>
      event.participants.some((p) => p.profile_id === profileId)

    if (filter === 'meus') {
      return events
        .filter((event) => attending(event) || event.created_by === profileId)
        .slice()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    }
    if (filter === 'encerrados') {
      return events
        .filter((event) => isPastEvent(event.starts_at, event.ends_at))
        .slice()
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    }
    return events
      .filter(
        (event) =>
          !isPastEvent(event.starts_at, event.ends_at) && event.status !== 'draft',
      )
      .slice()
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [events, filter, profileId])

  return (
    <section className="event-list">
      <p className="section-label">Eventos{communityName ? ` · ${communityName}` : ''}</p>

      <div className="circle-list-filters" role="tablist" aria-label="Filtrar eventos">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`circle-list-filter${filter === item.key ? ' circle-list-filter--active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p>Carregando eventos...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          message={
            filter === 'meus'
              ? 'Você ainda não confirmou presença em nenhum evento.'
              : filter === 'encerrados'
                ? 'Nenhum evento encerrado.'
                : 'Nenhum evento próximo. Volte em breve 🌿'
          }
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="event-list-items">
          {visible.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              profileId={profileId}
              circleName={event.circle_id ? circleName.get(event.circle_id) : null}
              canRsvp={canRsvp}
              onRsvp={() => onRsvp(event.id)}
              onCancelRsvp={() => onCancelRsvp(event.id)}
              isSaved={savedEventIds?.has(event.id)}
              onToggleSave={
                onToggleSave ? (saved) => onToggleSave(event.id, saved) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
