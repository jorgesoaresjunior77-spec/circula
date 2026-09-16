import { useEffect, useMemo, useState } from 'react'
import type { EventWithParticipants } from '../types/event'
import type { CircleWithMembers } from '../types/circle'
import { EventCard } from './EventCard'
import { EmptyState } from './EmptyState'
import { CloseIcon } from './icons'
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

// Fase E — só a quantidade para preencher a largura da grade real
// (.event-grid vira 3 colunas no desktop); puramente decorativo.
const SKELETON_GRID_KEYS = ['a', 'b', 'c']

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

  // Redesign editorial (Fase C) — sem campo/query novos: na aba
  // "Próximos" (a única ordenada starts_at asc), o primeiro item vira
  // destaque e os demais vão para a grade. Nas abas "Meus
  // eventos"/"Encerrados" não há destaque — só a grade, como antes.
  // `visible` continua sendo exatamente a mesma lista/lógica de sempre.
  const featured = filter === 'proximos' ? (visible[0] ?? null) : null
  const gridItems = filter === 'proximos' ? visible.slice(1) : visible

  // Fase D — detalhe = overlay local (sem rota nova). Busca em `events`
  // (a lista completa vinda do hook, não a `visible` filtrada pela aba),
  // igual ao `selectedProduct` do ProductManager — assim o detalhe
  // continua correto mesmo se a aba mudar enquanto está aberto.
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const selectedEvent = selectedEventId
    ? (events.find((event) => event.id === selectedEventId) ?? null)
    : null

  // ESC fecha; rolagem do fundo trava enquanto aberto — mesmo padrão já
  // usado no detalhe da Loja (ProductManager.tsx) e na folha de
  // navegação (PrimaryNav.tsx).
  useEffect(() => {
    if (!selectedEvent) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedEventId(null)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedEvent])

  function renderCard(event: EventWithParticipants, variant: 'featured' | 'grid' | 'detail') {
    return (
      <EventCard
        key={event.id}
        variant={variant}
        event={event}
        profileId={profileId}
        circleName={event.circle_id ? circleName.get(event.circle_id) : null}
        canRsvp={canRsvp}
        onRsvp={() => onRsvp(event.id)}
        onCancelRsvp={() => onCancelRsvp(event.id)}
        isSaved={savedEventIds?.has(event.id)}
        onToggleSave={onToggleSave ? (saved) => onToggleSave(event.id, saved) : undefined}
        onSelect={variant !== 'detail' ? () => setSelectedEventId(event.id) : undefined}
      />
    )
  }

  return (
    <>
      <section className="event-list event-list--editorial">
        <div className="event-masthead">
          <p className="section-label">Eventos{communityName ? ` · ${communityName}` : ''}</p>
          <h2 className="event-masthead-title">Encontros que fazem parte da sua jornada</h2>
          <p className="event-masthead-intro">
            Uma seleção dos próximos encontros da comunidade — para participar de perto ou à
            distância.
          </p>
        </div>

        {!loading && !error && featured && renderCard(featured, 'featured')}

        {loading && (
          <div className="event-skeleton-featured" aria-hidden="true">
            <div className="event-skeleton-media" />
            <div className="event-skeleton-lines">
              <span className="event-skeleton-line event-skeleton-line--eyebrow" />
              <span className="event-skeleton-line event-skeleton-line--title" />
              <span className="event-skeleton-line event-skeleton-line--meta" />
            </div>
          </div>
        )}

        <div className="event-upcoming">
          <p className="section-label">Próximos encontros</p>

          <div className="event-filters" role="tablist" aria-label="Filtrar eventos">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                className={`event-filter-pill${filter === item.key ? ' event-filter-pill--active' : ''}`}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="event-grid event-skeleton" aria-hidden="true">
              {SKELETON_GRID_KEYS.map((key) => (
                <div key={key} className="event-skeleton-card">
                  <div className="event-skeleton-media" />
                  <span className="event-skeleton-line event-skeleton-line--eyebrow" />
                  <span className="event-skeleton-line event-skeleton-line--title" />
                </div>
              ))}
            </div>
          )}
          {!loading && error && <p className="auth-error">{error}</p>}

          {!loading && !error && visible.length === 0 && (
            <EmptyState
              message={
                filter === 'meus'
                  ? 'Você ainda não confirmou presença em nenhum evento.'
                  : filter === 'encerrados'
                    ? 'Nenhum evento encerrado.'
                    : 'Nenhum evento próximo. Volte em breve'
              }
            />
          )}

          {!loading && !error && gridItems.length > 0 && (
            <div className="event-grid">
              {gridItems.map((event) => renderCard(event, 'grid'))}
            </div>
          )}
        </div>
      </section>

      {selectedEvent && (
        <div className="event-detail-backdrop" onClick={() => setSelectedEventId(null)}>
          <div
            className="event-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${selectedEvent.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="event-detail-close"
              onClick={() => setSelectedEventId(null)}
              aria-label="Fechar"
            >
              <CloseIcon size={18} />
            </button>
            {renderCard(selectedEvent, 'detail')}
          </div>
        </div>
      )}
    </>
  )
}
