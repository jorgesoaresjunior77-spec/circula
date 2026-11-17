import { useState } from 'react'
import type { FormEvent } from 'react'
import { useContentSchedule } from '../hooks/useContentSchedule'
import { useContentRules } from '../hooks/useContentRules'
import {
  CONTENT_TYPES,
  MONTH_NAMES,
  PHASES,
  TYPE_COLORS,
  contentTypeLabel,
  groupSchedule,
  itemsByDay,
  monthGrid,
  monthKey,
  monthSummary,
  phaseLabel,
  shortDate,
} from '../lib/contentSchedule'
import type { ContentType, ScheduleItem, SchedulePhase, ScheduleRules } from '../lib/contentSchedule'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function RulesCard({
  month,
  title,
  rules,
  onSave,
}: {
  month: string
  title: string
  rules: ScheduleRules
  onSave: (v: ScheduleRules) => Promise<{ error: string | null }>
}) {
  const [draft, setDraft] = useState<ScheduleRules>(rules)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const num = (v: string): number | null => (v === '' ? null : Math.max(0, Math.min(50, Number(v) || 0)))

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const r = await onSave({ ...draft, month })
    setSaving(false)
    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: 'Regras salvas.' })
  }

  return (
    <form className="schedule-rules" onSubmit={(e) => void save(e)} aria-label={title}>
      <h5 className="schedule-rules-title">{title}</h5>
      <div className="schedule-rules-row">
        <label>
          Dias de produção
          <input
            type="number"
            min={0}
            max={31}
            inputMode="numeric"
            value={draft.production_days ?? ''}
            onChange={(e) => setDraft({ ...draft, production_days: num(e.target.value) })}
          />
        </label>
        <label>
          Publicações por semana
          <input
            type="number"
            min={0}
            max={50}
            inputMode="numeric"
            value={draft.posts_per_week ?? ''}
            onChange={(e) => setDraft({ ...draft, posts_per_week: num(e.target.value) })}
          />
        </label>
      </div>
      <label>
        Frequência das publicações
        <input
          type="text"
          maxLength={600}
          placeholder="Ex.: terças e sextas, às 10h"
          value={draft.frequency}
          onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
        />
      </label>
      <label>
        Regras para postagem
        <textarea
          rows={3}
          maxLength={4000}
          value={draft.posting_rules}
          onChange={(e) => setDraft({ ...draft, posting_rules: e.target.value })}
        />
      </label>
      <label>
        Organização dos conteúdos no mês
        <textarea
          rows={3}
          maxLength={4000}
          value={draft.organization}
          onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
        />
      </label>
      <button type="submit" className="cover-image-input-pick" disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar regras'}
      </button>
      {msg && (
        <p className={msg.ok ? 'auth-success' : 'auth-error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </form>
  )
}

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
  const rulesApi = useContentRules(communityId)
  const [type, setType] = useState<ContentType>('revista')
  const [phase, setPhase] = useState<SchedulePhase>('publicacao')
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
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
    const r = await add({ content_type: type, phase, title, notes, scheduled_on: date })
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
  const key = monthKey(cursor.year, cursor.month)
  const byDay = itemsByDay(items)
  const summary = monthSummary(items, key)
  const dayItems = byDay[date] ?? []

  function shiftMonth(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  return (
    <section className="schedule-panel" aria-label="Agenda de conteúdos">
      <header className="card-images-head">
        <h4 className="card-images-title">Agenda de conteúdos</h4>
        <p className="card-images-desc">
          Anote quando cada conteúdo precisa entrar no Círcula. É só um lembrete seu: as participantes não veem.
        </p>
      </header>

      <section className="schedule-cal" aria-label={`Calendário de ${MONTH_NAMES[cursor.month]} de ${cursor.year}`}>
        <div className="schedule-cal-head">
          <button type="button" className="schedule-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <strong>
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </strong>
          <button type="button" className="schedule-cal-nav" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
            ›
          </button>
        </div>
        <div className="schedule-cal-grid" role="grid">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="schedule-cal-wd" aria-hidden="true">
              {w}
            </span>
          ))}
          {monthGrid(cursor.year, cursor.month)
            .flat()
            .map((cell, i) => {
              if (!cell.iso) return <span key={i} className="schedule-cal-empty" />
              const dayList = byDay[cell.iso] ?? []
              const colors = [...new Set(dayList.map((it) => TYPE_COLORS[it.content_type] ?? TYPE_COLORS.outro))]
              const cls = [
                'schedule-cal-day',
                cell.iso === todayIso() ? 'schedule-cal-day--today' : '',
                cell.iso === date ? 'schedule-cal-day--picked' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => setDate(cell.iso as string)}
                  aria-label={`${cell.day} de ${MONTH_NAMES[cursor.month]}${dayList.length ? `, ${dayList.length} compromisso(s)` : ''}`}
                  aria-pressed={cell.iso === date}
                >
                  <span>{cell.day}</span>
                  <span className="schedule-cal-dots" aria-hidden="true">
                    {colors.slice(0, 4).map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                </button>
              )
            })}
        </div>
        <ul className="schedule-cal-legend" aria-label="Legenda das cores">
          {CONTENT_TYPES.map((t) => (
            <li key={t.key}>
              <i style={{ background: TYPE_COLORS[t.key] }} aria-hidden="true" />
              {t.label}
            </li>
          ))}
        </ul>
        <p className="schedule-cal-summary">
          {summary.total === 0
            ? 'Nada anotado neste mês.'
            : `${summary.productionDays} dia(s) de produção · ${summary.publishDays} dia(s) de publicação · ${summary.total} item(ns).`}
        </p>
        <div className="schedule-cal-day-list">
          <h5 className="schedule-group-title">Dia {shortDate(date)}</h5>
          {dayItems.length === 0 ? (
            <p className="home-muted">Nada neste dia. Use o formulário abaixo para anotar.</p>
          ) : (
            <ul className="schedule-list">
              {dayItems.map((it) => (
                <li key={it.id} className={`schedule-item${it.done ? ' schedule-item--done' : ''}`}>
                  <i className="schedule-dot" style={{ background: TYPE_COLORS[it.content_type] }} aria-hidden="true" />
                  <div className="schedule-body">
                    <span className="schedule-tag">
                      {contentTypeLabel(it.content_type)} · {phaseLabel(it.phase)}
                    </span>
                    <strong>{it.title}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="schedule-rules-wrap" aria-label="Regras de conteúdo">
        <RulesCard
          key={`m-${key}-${rulesApi.loading}`}
          month={key}
          title={`Regras de ${MONTH_NAMES[cursor.month]} de ${cursor.year}`}
          rules={rulesApi.get(key)}
          onSave={rulesApi.save}
        />
        <RulesCard
          key={`g-${rulesApi.loading}`}
          month="geral"
          title="Regras gerais (valem para todos os meses)"
          rules={rulesApi.get('geral')}
          onSave={rulesApi.save}
        />
      </section>

      <form className="schedule-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="schedule-types" role="radiogroup" aria-label="Produção ou publicação">
          {PHASES.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={phase === p.key}
              className={`schedule-type${phase === p.key ? ' schedule-type--on' : ''}`}
              onClick={() => setPhase(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
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
                    <span className="schedule-tag">
                      {contentTypeLabel(it.content_type)} · {phaseLabel(it.phase)}
                    </span>
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
