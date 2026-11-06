import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { useAppointments } from '../hooks/useAppointments'
import type { Appointment, AppointmentInput } from '../hooks/useAppointments'
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  addDaysIso,
  monthGrid,
  parseIso,
  todayParts,
  weekDays,
  weekTitle,
} from '../lib/weekCalendar'
import { utcToZoned, zonedToUtcIso } from '../lib/zonedTime'

// Agenda do membro: visão semanal e mensal, compromissos com observações.
// Tudo no fuso de São Paulo; só a própria pessoa vê e altera (RLS).

type View = 'week' | 'month'

interface AgendaPageProps {
  profileId: string
}

function isoOf(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

function formatDayHeading(iso: string): string {
  const { year, month, day } = parseIso(iso)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const weekday = WEEKDAY_LABELS[(dow + 6) % 7]
  return `${weekday}, ${day} de ${MONTH_LABELS[month - 1].toLowerCase()}`
}

function timeLabel(a: Appointment): string {
  if (a.all_day) return 'Dia todo'
  const start = utcToZoned(a.starts_at).time
  if (!a.ends_at) return start
  return `${start} – ${utcToZoned(a.ends_at).time}`
}

interface FormState {
  id: string | null
  title: string
  date: string
  allDay: boolean
  start: string
  end: string
  notes: string
}

function emptyForm(date: string): FormState {
  return { id: null, title: '', date, allDay: false, start: '09:00', end: '', notes: '' }
}

function formFrom(a: Appointment): FormState {
  const s = utcToZoned(a.starts_at)
  return {
    id: a.id,
    title: a.title,
    date: s.date,
    allDay: a.all_day,
    start: a.all_day ? '09:00' : s.time,
    end: a.ends_at && !a.all_day ? utcToZoned(a.ends_at).time : '',
    notes: a.notes ?? '',
  }
}

export function AgendaPage({ profileId }: AgendaPageProps) {
  const today = useMemo(() => todayParts(), [])
  const todayIso = isoOf(today)

  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(todayIso)
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const a = parseIso(anchor)
  const week = useMemo(() => weekDays(a, 0), [a.year, a.month, a.day]) // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => monthGrid(a.year, a.month, today), [a.year, a.month, today])

  const rangeFirst = view === 'week' ? week[0].iso : grid[0][0].iso
  const rangeLast = view === 'week' ? week[6].iso : grid[grid.length - 1][6].iso
  const fromIso = zonedToUtcIso(rangeFirst, '00:00')
  const toIso = zonedToUtcIso(addDaysIso(rangeLast, 1), '00:00')

  const { items, loading, error, add, update, remove } = useAppointments(profileId, fromIso, toIso)

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const item of items) {
      const day = utcToZoned(item.starts_at).date
      map.set(day, [...(map.get(day) ?? []), item])
    }
    return map
  }, [items])

  function shift(direction: -1 | 1) {
    if (view === 'week') {
      setAnchor(addDaysIso(anchor, 7 * direction))
      return
    }
    const next = new Date(Date.UTC(a.year, a.month - 1 + direction, 1))
    setAnchor(isoOf({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: 1 }))
  }

  const title = view === 'week' ? weekTitle(week) : `${MONTH_LABELS[a.month - 1]} ${a.year}`

  function openNew(date: string) {
    setForm(emptyForm(date))
    setFormError(null)
    setConfirmDelete(false)
  }

  function openEdit(item: Appointment) {
    setForm(formFrom(item))
    setFormError(null)
    setConfirmDelete(false)
  }

  function closeForm() {
    setForm(null)
    setFormError(null)
    setConfirmDelete(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const name = form.title.trim()
    if (!name) {
      setFormError('Dê um nome ao compromisso.')
      return
    }
    if (!form.date) {
      setFormError('Escolha o dia.')
      return
    }
    const startsAt = zonedToUtcIso(form.date, form.allDay ? '00:00' : form.start || '00:00')
    let endsAt: string | null = null
    if (!form.allDay && form.end) {
      endsAt = zonedToUtcIso(form.date, form.end)
      if (endsAt < startsAt) {
        setFormError('O fim não pode ser antes do começo.')
        return
      }
    }
    const input: AppointmentInput = {
      title: name,
      notes: form.notes.trim() ? form.notes.trim() : null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: form.allDay,
    }
    setSaving(true)
    setFormError(null)
    const result = form.id ? await update(form.id, input) : await add(input)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setAnchor(form.date)
    closeForm()
  }

  async function handleDelete() {
    if (!form?.id) return
    setSaving(true)
    const result = await remove(form.id)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    closeForm()
  }

  function renderItems(day: string) {
    const list = byDay.get(day) ?? []
    if (list.length === 0) return <p className="agenda-empty">Nada marcado.</p>
    return (
      <ul className="agenda-items">
        {list.map((item) => (
          <li key={item.id}>
            <button type="button" className="agenda-item" onClick={() => openEdit(item)}>
              <span className="agenda-item-time">{timeLabel(item)}</span>
              <span className="agenda-item-title">{item.title}</span>
              {item.notes && <span className="agenda-item-notes">{item.notes}</span>}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="agenda-page">
      <h2>Agenda</h2>

      <div className="agenda-toolbar">
        <div className="agenda-nav">
          <button type="button" className="agenda-icon-btn" onClick={() => shift(-1)} aria-label={view === 'week' ? 'Semana anterior' : 'Mês anterior'}>
            <ChevronLeftIcon size={18} />
          </button>
          <h3 className="agenda-title">{title}</h3>
          <button type="button" className="agenda-icon-btn" onClick={() => shift(1)} aria-label={view === 'week' ? 'Próxima semana' : 'Próximo mês'}>
            <ChevronRightIcon size={18} />
          </button>
        </div>

        <div className="agenda-actions">
          <div className="agenda-toggle" role="group" aria-label="Modo de visualização">
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
              Semana
            </button>
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>
              Mês
            </button>
          </div>
          <button type="button" className="agenda-link-btn" onClick={() => setAnchor(todayIso)}>
            Hoje
          </button>
          <button type="button" className="agenda-add-btn" onClick={() => openNew(view === 'week' ? todayIso : anchor)}>
            Novo compromisso
          </button>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {loading && <p className="home-muted">Carregando…</p>}

      {form && (
        <form className="agenda-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar compromisso' : 'Novo compromisso'}>
          <h3>{form.id ? 'Editar compromisso' : 'Novo compromisso'}</h3>

          <label>
            Nome
            <input
              type="text"
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </label>

          <label>
            Dia
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>

          <label className="agenda-check">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
            Dia todo
          </label>

          {!form.allDay && (
            <div className="agenda-form-times">
              <label>
                Começa
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label>
                Termina (opcional)
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
          )}

          <label>
            Observações
            <textarea
              value={form.notes}
              maxLength={2000}
              rows={3}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          {formError && <p className="auth-error">{formError}</p>}

          <div className="agenda-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="agenda-link-btn" onClick={closeForm} disabled={saving}>
              Cancelar
            </button>
            {form.id &&
              (confirmDelete ? (
                <button type="button" className="agenda-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" className="agenda-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Excluir
                </button>
              ))}
          </div>
        </form>
      )}

      {view === 'week' ? (
        <div className="agenda-week">
          {week.map((day) => (
            <section key={day.iso} className={`agenda-day${day.isToday ? ' agenda-day--today' : ''}`} aria-label={formatDayHeading(day.iso)}>
              <h4 className="agenda-day-heading">{formatDayHeading(day.iso)}</h4>
              {renderItems(day.iso)}
            </section>
          ))}
        </div>
      ) : (
        <div className="agenda-month">
          <div className="agenda-month-head" aria-hidden="true">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          {grid.map((row) => (
            <div key={row[0].iso} className="agenda-month-row">
              {row.map((day) => {
                const has = (byDay.get(day.iso)?.length ?? 0) > 0
                const selected = day.iso === anchor
                return (
                  <button
                    key={day.iso}
                    type="button"
                    className={
                      'agenda-month-day' +
                      (day.inMonth ? '' : ' agenda-month-day--out') +
                      (day.isToday ? ' agenda-month-day--today' : '') +
                      (selected ? ' agenda-month-day--selected' : '')
                    }
                    aria-pressed={selected}
                    aria-label={`${formatDayHeading(day.iso)}${has ? ', com compromissos' : ''}`}
                    onClick={() => setAnchor(day.iso)}
                  >
                    <span>{day.day}</span>
                    {has && <span className="agenda-dot" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          ))}
          <section className="agenda-day" aria-label={formatDayHeading(anchor)}>
            <h4 className="agenda-day-heading">{formatDayHeading(anchor)}</h4>
            {renderItems(anchor)}
          </section>
        </div>
      )}

    </section>
  )
}
