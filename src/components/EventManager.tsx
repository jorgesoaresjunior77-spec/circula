import { useState } from 'react'
import type { FormEvent } from 'react'
import { useEvents } from '../hooks/useEvents'
import { useCircles } from '../hooks/useCircles'
import type { EventInput, EventStatus, EventWithParticipants } from '../types/event'
import { EventCard } from './EventCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'
import {
  formatEventDate,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/formatEventDate'

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
    <section className="community-card community-card--quiet event-manager">
      <h3>Eventos da comunidade</h3>

      {canManage && (
      <form onSubmit={handleSubmit} className="event-form">
        <label htmlFor="event-title">Título</label>
        <input
          id="event-title"
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Ex.: Roda de conversa"
          required
        />

        <label htmlFor="event-desc">Descrição (opcional)</label>
        <textarea
          id="event-desc"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
        />

        <CoverImageInput
          id="event-cover"
          communityId={communityId}
          uid={profileId}
          value={form.coverImageUrl}
          onChange={(url) => set('coverImageUrl', url)}
        />

        <div className="event-form-row">
          <div>
            <label htmlFor="event-start">Início</label>
            <input
              id="event-start"
              type="datetime-local"
              value={form.startsAtLocal}
              onChange={(e) => set('startsAtLocal', e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="event-end">Término (opcional)</label>
            <input
              id="event-end"
              type="datetime-local"
              value={form.endsAtLocal}
              onChange={(e) => set('endsAtLocal', e.target.value)}
            />
          </div>
        </div>

        <label className="event-form-check">
          <input
            type="checkbox"
            checked={form.isOnline}
            onChange={(e) => set('isOnline', e.target.checked)}
          />
          Evento online
        </label>

        {form.isOnline ? (
          <>
            <label htmlFor="event-url">Link do evento online</label>
            <input
              id="event-url"
              type="url"
              value={form.onlineUrl}
              onChange={(e) => set('onlineUrl', e.target.value)}
              placeholder="https://..."
            />
          </>
        ) : (
          <>
            <label htmlFor="event-location">Local</label>
            <input
              id="event-location"
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Endereço ou ponto de encontro"
            />
          </>
        )}

        <div className="event-form-row">
          <div>
            <label htmlFor="event-capacity">Limite de participantes (opcional)</label>
            <input
              id="event-capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="event-circle">Círculo (opcional)</label>
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

        <label htmlFor="event-status">Publicação</label>
        <select
          id="event-status"
          value={form.status}
          onChange={(e) => set('status', e.target.value as EventStatus)}
        >
          <option value="published">Publicado</option>
          <option value="draft">Rascunho</option>
        </select>

        {formError && <p className="auth-error">{formError}</p>}

        <div className="challenge-item-actions">
          {editingId && (
            <button type="button" className="auth-link" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
          <button type="submit" className="challenge-save-button" disabled={busy}>
            {busy ? 'Salvando...' : editingId ? 'Salvar evento' : 'Criar evento'}
          </button>
        </div>
      </form>
      )}

      {loading && <p>Carregando eventos...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <EmptyState message="Nenhum evento criado ainda." />
      )}

      {!loading &&
        !error &&
        events.map((event) => (
          <div key={event.id} className="event-block">
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
            <div className="challenge-item-actions">
              <span className="event-block-when">
                {formatEventDate(event.starts_at, event.ends_at)}
              </span>
              <button type="button" onClick={() => startEdit(event)}>
                Editar
              </button>
              {event.status !== 'cancelled' && (
                <button type="button" onClick={() => handleCancelEvent(event)}>
                  Cancelar evento
                </button>
              )}
              <button
                type="button"
                className="challenge-delete-button"
                onClick={() => deleteEvent(event.id)}
              >
                Excluir
              </button>
            </div>
            )}
          </div>
        ))}
    </section>
  )
}
