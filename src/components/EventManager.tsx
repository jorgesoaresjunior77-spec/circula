import { useState } from 'react'
import type { FormEvent } from 'react'
import { useEvents } from '../hooks/useEvents'
import { useCircles } from '../hooks/useCircles'
import type { EventInput, EventStatus, EventWithParticipants } from '../types/event'
import { EventCard } from './EventCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/formatEventDate'

interface EventManagerProps {
  communityId: string
  profileId: string
  /** false = visão somente leitura (Master): sem formulário nem ações. */
  canManage?: boolean
}

interface FormState {
  title: string
  description: string
  coverImageUrl: string
  startsAtLocal: string
  endsAtLocal: string
  isOnline: boolean
  location: string
  onlineUrl: string
  capacity: string
  circleId: string
  status: EventStatus
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  coverImageUrl: '',
  startsAtLocal: '',
  endsAtLocal: '',
  isOnline: false,
  location: '',
  onlineUrl: '',
  capacity: '',
  circleId: '',
  status: 'published',
}

function toInput(form: FormState): EventInput | { error: string } {
  const startsAt = fromDatetimeLocalValue(form.startsAtLocal)
  if (!form.title.trim()) return { error: 'Informe o título do evento.' }
  if (!startsAt) return { error: 'Informe a data e o horário de início.' }
  const endsAt = fromDatetimeLocalValue(form.endsAtLocal)
  if (endsAt && endsAt < startsAt) return { error: 'O término não pode ser antes do início.' }
  const capacityNum = form.capacity.trim() ? Number(form.capacity) : null
  if (capacityNum != null && (!Number.isFinite(capacityNum) || capacityNum <= 0)) {
    return { error: 'Limite de participantes inválido.' }
  }
  return {
    title: form.title,
    description: form.description,
    cover_image_url: form.coverImageUrl,
    starts_at: startsAt,
    ends_at: endsAt,
    is_online: form.isOnline,
    location: form.location,
    online_url: form.onlineUrl,
    capacity: capacityNum,
    circle_id: form.circleId || null,
    status: form.status,
  }
}

function formFromEvent(event: EventWithParticipants): FormState {
  return {
    title: event.title,
    description: event.description ?? '',
    coverImageUrl: event.cover_image_url ?? '',
    startsAtLocal: toDatetimeLocalValue(event.starts_at),
    endsAtLocal: toDatetimeLocalValue(event.ends_at),
    isOnline: event.is_online,
    location: event.location ?? '',
    onlineUrl: event.online_url ?? '',
    capacity: event.capacity != null ? String(event.capacity) : '',
    circleId: event.circle_id ?? '',
    status: event.status === 'cancelled' ? 'published' : event.status,
  }
}

export function EventManager({ communityId, profileId, canManage = true }: EventManagerProps) {
  const { events, loading, error, createEvent, updateEvent, deleteEvent, rsvp, cancelRsvp } =
    useEvents(communityId)
  const { circles } = useCircles(communityId)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = toInput(form)
    if ('error' in parsed) {
      setFormError(parsed.error)
      return
    }
    setBusy(true)
    setFormError(null)
    const { error: opError } = editingId
      ? await updateEvent(editingId, parsed)
      : await createEvent(profileId, parsed)
    setBusy(false)
    if (opError) {
      setFormError('Não foi possível salvar o evento agora. Tente novamente.')
      return
    }
    resetForm()
  }

  function startEdit(event: EventWithParticipants) {
    setEditingId(event.id)
    setForm(formFromEvent(event))
    setFormError(null)
  }

  async function handleCancelEvent(event: EventWithParticipants) {
    const parsed = toInput(formFromEvent(event))
    if ('error' in parsed) return
    await updateEvent(event.id, { ...parsed, status: 'cancelled' })
  }

  return (
    <section className="panel-events">
      <header className="panel-events-head">
        <p className="panel-events-title">Painel · Eventos</p>
        <p className="panel-events-intro">
          Encontros da sua comunidade — presenciais ou online, com vagas e confirmação de presença.
        </p>
      </header>

      {canManage && (
        <div className="panel-events-block">
          <h3 className="panel-events-eyebrow">{editingId ? 'Editar evento' : 'Criar evento'}</h3>

          <form onSubmit={handleSubmit} className="panel-events-form">
            <div className="panel-events-form-group">
              <p className="panel-events-form-group-title">O evento</p>

              <div className="panel-events-field">
                <label className="panel-events-label" htmlFor="event-title">
                  Título
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Ex.: Roda de conversa"
                  required
                />
              </div>

              <div className="panel-events-field">
                <label className="panel-events-label" htmlFor="event-desc">
                  Descrição (opcional)
                </label>
                <textarea
                  id="event-desc"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                />
              </div>

              <CoverImageInput
                id="event-cover"
                communityId={communityId}
                uid={profileId}
                value={form.coverImageUrl}
                onChange={(url) => set('coverImageUrl', url)}
              />
            </div>

            <div className="panel-events-form-group">
              <p className="panel-events-form-group-title">Quando e onde</p>

              <div className="panel-events-form-row">
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-start">
                    Início
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={form.startsAtLocal}
                    onChange={(e) => set('startsAtLocal', e.target.value)}
                    required
                  />
                </div>
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-end">
                    Término (opcional)
                  </label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={form.endsAtLocal}
                    onChange={(e) => set('endsAtLocal', e.target.value)}
                  />
                </div>
              </div>

              <label className="panel-events-check">
                <input
                  type="checkbox"
                  checked={form.isOnline}
                  onChange={(e) => set('isOnline', e.target.checked)}
                />
                Evento online
              </label>

              {form.isOnline ? (
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-url">
                    Link do evento online
                  </label>
                  <input
                    id="event-url"
                    type="url"
                    value={form.onlineUrl}
                    onChange={(e) => set('onlineUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-location">
                    Local
                  </label>
                  <input
                    id="event-location"
                    type="text"
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    placeholder="Endereço ou ponto de encontro"
                  />
                </div>
              )}
            </div>

            <div className="panel-events-form-group">
              <p className="panel-events-form-group-title">Vagas e publicação</p>

              <div className="panel-events-form-row">
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-capacity">
                    Limite de participantes (opcional)
                  </label>
                  <input
                    id="event-capacity"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => set('capacity', e.target.value)}
                  />
                </div>
                <div className="panel-events-field">
                  <label className="panel-events-label" htmlFor="event-circle">
                    Círculo (opcional)
                  </label>
                  <select
                    id="event-circle"
                    value={form.circleId}
                    onChange={(e) => set('circleId', e.target.value)}
                  >
                    <option value="">Toda a comunidade</option>
                    {circles.map((circle) => (
                      <option key={circle.id} value={circle.id}>
                        {circle.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="panel-events-field">
                <label className="panel-events-label" htmlFor="event-status">
                  Publicação
                </label>
                <select
                  id="event-status"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as EventStatus)}
                >
                  <option value="published">Publicado</option>
                  <option value="draft">Rascunho</option>
                </select>
              </div>
            </div>

            {formError && <p className="auth-error">{formError}</p>}

            <div className="panel-events-form-actions">
              {editingId && (
                <button type="button" className="panel-events-action" onClick={resetForm}>
                  Cancelar edição
                </button>
              )}
              <button type="submit" className="panel-events-submit" disabled={busy}>
                {busy ? 'Salvando...' : editingId ? 'Salvar evento' : 'Criar evento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel-events-block">
        <h3 className="panel-events-eyebrow">Eventos da comunidade</h3>

        {loading && <p className="panel-events-muted">Carregando eventos...</p>}
        {!loading && error && <p className="auth-error">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <EmptyState message="Nenhum evento criado ainda." />
        )}

        {!loading && !error && events.length > 0 && (
          <div className="panel-events-list">
            {events.map((event) => (
              <div key={event.id} className="panel-events-item">
                <EventCard
                  event={event}
                  profileId={profileId}
                  circleName={
                    event.circle_id
                      ? (circles.find((c) => c.id === event.circle_id)?.name ?? null)
                      : null
                  }
                  canRsvp={canManage}
                  onRsvp={() => rsvp(event.id, profileId)}
                  onCancelRsvp={() => cancelRsvp(event.id, profileId)}
                />
                {canManage && (
                  <div className="panel-events-item-actions">
                    <button
                      type="button"
                      className="panel-events-action"
                      onClick={() => startEdit(event)}
                    >
                      Editar
                    </button>
                    {event.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="panel-events-action"
                        onClick={() => handleCancelEvent(event)}
                      >
                        Cancelar evento
                      </button>
                    )}
                    <button
                      type="button"
                      className="panel-events-action panel-events-action--delete"
                      onClick={() => deleteEvent(event.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
