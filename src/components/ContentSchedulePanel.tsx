import { useState } from 'react'
import { useContentSchedule } from '../hooks/useContentSchedule'
import {
  CONTENT_TYPES,
  MONTH_NAMES,
  TYPE_COLORS,
  contentTypeLabel,
  itemsByDay,
  monthGrid,
  monthKey,
  monthSummary,
  phaseLabel,
  shortDate,
} from '../lib/contentSchedule'
import { CONTENT_RULES, RULES_START, addDays, ruleItems } from '../lib/contentRules'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// Painel → Agenda de conteúdos: o calendário se preenche sozinho pelas regras
// fixas (lib/contentRules), a partir de 01/12/2026, e o sino avisa a
// profissional um dia antes de cada publicação. É só um lembrete dela.

function todayIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function ContentSchedulePanel({ communityId }: { communityId: string }) {
  const { items, loading } = useContentSchedule(communityId)
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [date, setDate] = useState(todayIso())

  const key = monthKey(cursor.year, cursor.month)
  const monthEnd = `${key}-${String(new Date(cursor.year, cursor.month + 1, 0).getDate()).padStart(2, '0')}`
  // Itens anotados antes + os que as regras fixas preveem para o mês na tela
  // e para o dia escolhido (que pode estar em outro mês).
  const monthItems = [...items, ...ruleItems(`${key}-01`, monthEnd, communityId)]
  const byDay = itemsByDay(
    date.startsWith(`${key}-`) ? monthItems : [...monthItems, ...ruleItems(date, date, communityId)],
  )
  const summary = monthSummary(monthItems, key)
  const dayItems = byDay[date] ?? []

  // Próximos 30 dias, em lista, para nada passar batido.
  const today = todayIso()
  const upcoming = ruleItems(today, addDays(today, 30), communityId)
  const upcomingByDay = itemsByDay(upcoming)
  const upcomingDays = Object.keys(upcomingByDay).sort()

  function shiftMonth(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  return (
    <section className="schedule-panel" aria-label="Agenda de conteúdos">
      <header className="card-images-head">
        <h4 className="card-images-title">Agenda de conteúdos</h4>
        <p className="card-images-desc">
          O calendário se preenche sozinho pelas regras abaixo, a partir de 01/12/2026. Um dia antes de cada publicação
          você recebe um aviso no sininho. É só um lembrete seu: as participantes não veem.
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
          {CONTENT_TYPES.filter((t) => t.key !== 'outro').map((t) => (
            <li key={t.key}>
              <i style={{ background: TYPE_COLORS[t.key] }} aria-hidden="true" />
              {t.label}
            </li>
          ))}
        </ul>
        <p className="schedule-cal-summary">
          {summary.total === 0
            ? key < RULES_START.slice(0, 7)
              ? 'As regras valem a partir de dezembro de 2026.'
              : 'Nada previsto neste mês.'
            : `${summary.publishDays} dia(s) de publicação · ${summary.total} item(ns).`}
        </p>
        <div className="schedule-cal-day-list">
          <h5 className="schedule-group-title">Dia {shortDate(date)}</h5>
          {dayItems.length === 0 ? (
            <p className="home-muted">Nada neste dia.</p>
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

      <section className="schedule-upcoming" aria-label="Próximas publicações">
        <h5 className="schedule-rules-title">Próximos 30 dias</h5>
        {upcomingDays.length === 0 ? (
          <p className="home-muted">Nada previsto nos próximos 30 dias.</p>
        ) : (
          <ul className="schedule-upcoming-list">
            {upcomingDays.map((d) => (
              <li key={d} className="schedule-upcoming-day">
                <span className="schedule-upcoming-date">{shortDate(d)}</span>
                <ul>
                  {upcomingByDay[d].map((it) => (
                    <li key={it.id}>
                      <i style={{ background: TYPE_COLORS[it.content_type] }} aria-hidden="true" />
                      <span>
                        <strong>{contentTypeLabel(it.content_type)}</strong>
                        <small>{it.title}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="schedule-rules-wrap" aria-label="Regras de conteúdo">
        <h5 className="schedule-rules-title">Regras fixas (valem a partir de 01/12/2026)</h5>
        <ul className="schedule-rules-list">
          {CONTENT_RULES.map((r) => (
            <li key={r.type}>
              <i style={{ background: TYPE_COLORS[r.type] }} aria-hidden="true" />
              <strong>{contentTypeLabel(r.type)}</strong>: {r.summary.toLowerCase()}
            </li>
          ))}
        </ul>
      </section>

      {loading && <p className="home-muted">Carregando…</p>}
    </section>
  )
}
