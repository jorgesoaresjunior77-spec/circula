import { useState } from 'react'
import type { FormEvent } from 'react'
import { useContentSchedule } from '../hooks/useContentSchedule'
import { CONTENT_TYPES, contentTypeLabel, groupSchedule, shortDate } from '../lib/contentSchedule'
import type { ContentType, ScheduleItem } from '../lib/contentSchedule'

// Painel → Agenda de conteúdos: a profissional anota quando precisa publicar
// cada tipo de conteúdo (evento, loja, receitas, revista, respiração,
// playlist, dicas de leitura, wellness). É só um lembrete dela.

function todayIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const GROUPS: { key: 'late' | 'today' | 'upcoming' | 'done'; title: string }[] = [
  { key: 'late', title: 'Atrasados' },
  { key: 'today', title: 'Hoje' },
  { key: 'upcoming', title: 'Próximos' },
  { key: 'done', title: 'Já publicados' },
]

export function ContentSchedulePanel({ communityId }: { communityId: string }) {
  const { items, loading, add, setDone, remove } = useContentSchedule(communityId)
  const [type, setType] = useState<ContentType>('revista')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Dê um nome ao lembrete.')
      return
    }
    if (!date) {
      setError('Escolha a data.')
      return
    }
    setSaving(true)
    setError(null)
    const r = await add({ content_type: type, title, notes, scheduled_on: date })
    setSaving(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setTitle('')
    setNotes('')
  }

  async function run(op: Promise<{ error: string | null }>) {
    setError(null)
    const r = await op
    if (r.error) setError(r.error)
  }

  const groups = groupSchedule(items, todayIso())

  return (
    <section className="schedule-panel" aria-label="Agenda de conteúdos">
      <header className="card-images-head">
        <h4 className="card-images-title">Agenda de conteúdos</h4>
        <p className="card-images-desc">
          Anote quando cada conteúdo precisa entrar no Círcula. É só um lembrete seu: as participantes não veem.
        </p>
      </header>

      <form className="schedule-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="schedule-types" role="radiogroup" aria-label="Tipo de conteúdo">
          {CONTENT_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              className={`schedule-type${type === t.key ? ' schedule-type--on' : ''}`}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="magazine-input"
          placeholder="O que publicar (ex.: Revista de dezembro)"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="card-images-hint">
          Para o dia <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <textarea
          className="magazine-input"
          rows={2}
          maxLength={600}
          placeholder="Observação (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" className="cover-image-input-pick" disabled={saving}>
          {saving ? 'Salvando…' : 'Anotar na agenda'}
        </button>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </form>

      {loading && <p className="home-muted">Carregando…</p>}
      {!loading && items.length === 0 && <p className="home-muted">Nenhum lembrete ainda.</p>}

      {GROUPS.map((g) =>
        groups[g.key].length === 0 ? null : (
          <section key={g.key} className="schedule-group">
            <h5 className={`schedule-group-title schedule-group-title--${g.key}`}>{g.title}</h5>
            <ul className="schedule-list">
              {groups[g.key].map((it: ScheduleItem) => (
                <li key={it.id} className={`schedule-item${it.done ? ' schedule-item--done' : ''}`}>
                  <label className="schedule-check">
                    <input
                      type="checkbox"
                      checked={it.done}
                      onChange={(e) => void run(setDone(it.id, e.target.checked))}
                      aria-label={`Marcar ${it.title} como publicado`}
                    />
                  </label>
                  <div className="schedule-body">
                    <span className="schedule-tag">{contentTypeLabel(it.content_type)}</span>
                    <strong>{it.title}</strong>
                    {it.notes && <span className="schedule-notes">{it.notes}</span>}
                  </div>
                  <span className="schedule-date">{shortDate(it.scheduled_on)}</span>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => {
                      if (window.confirm(`Excluir "${it.title}" da agenda?`)) void run(remove(it.id))
                    }}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </section>
  )
}
