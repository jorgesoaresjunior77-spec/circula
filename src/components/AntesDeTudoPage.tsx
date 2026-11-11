import { useState } from 'react'
import { HabitWomanView } from './Doll3DView'
import { CheckIcon, ChevronRightIcon } from './icons'
import type { NavKey } from './PrimaryNav'
import { useHabits } from '../hooks/useHabits'
import { HABITS, countDone } from '../lib/habits'
import { MONTH_LABELS, addDaysIso, parseIso } from '../lib/weekCalendar'

// ANTES DE TUDO — ritual diário de hábitos. Acolhedor: sem culpa, sem
// pressão, sem "sequência quebrada". Dia sem check é só um dia em branco.

interface AntesDeTudoPageProps {
  profileId: string
  onNavigate: (key: NavKey) => void
}

const HISTORY_SHOWN = 14

function dayLabel(iso: string): string {
  const { month, day } = parseIso(iso)
  return `${day} de ${MONTH_LABELS[month - 1].toLowerCase()}`
}

function message(done: number): string {
  if (done === 0) return 'Cada dia é um começo novo. Escolha um pequeno hábito para abrir o seu.'
  if (done < HABITS.length) return 'Muito bem! Cada pequeno passo conta.'
  return 'Ritual completo de hoje. Que dia bonito você começou! 🌸'
}

export function AntesDeTudoPage({ profileId, onNavigate }: AntesDeTudoPageProps) {
  const { today, loading, error, checkedToday, history, toggle } = useHabits(profileId)
  const [message_, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const done = countDone(checkedToday)

  async function handleToggle(key: (typeof HABITS)[number]['key']) {
    setBusy(true)
    setMessage(null)
    const { error: err } = await toggle(key)
    setBusy(false)
    if (err) setMessage(err)
  }

  // Últimos 14 dias antes de hoje, do mais antigo ao mais recente; dia sem
  // registro aparece vazio, sem nenhuma marca de "falha".
  const counts = new Map(history.map((h) => [h.day, h.count]))
  const days = Array.from({ length: HISTORY_SHOWN }, (_, i) =>
    addDaysIso(today, -(HISTORY_SHOWN - i)),
  )

  return (
    <section className="habits-page">
      <h2>ANTES DE TUDO</h2>
      <p className="habits-sub">Pequenos hábitos. Uma vida melhor.</p>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}
      {message_ && (
        <p className="auth-error" role="alert">
          {message_}
        </p>
      )}

      <article className="habits-panel habits-hero">
        <HabitWomanView done={done} checked={checkedToday} />
        <div className="habits-hero-text">
          <p className="habits-count" aria-live="polite">
            {done} de {HABITS.length}
          </p>
          <p className="habits-message">{message(done)}</p>
        </div>
      </article>

      <article className="habits-panel">
        <h3>Seu ritual de hoje</h3>
        <ul className="habits-list">
          {HABITS.map((habit) => {
            const on = checkedToday.has(habit.key)
            return (
              <li key={habit.key} className={`habits-row${on ? ' habits-row--on' : ''}`}>
                <button
                  type="button"
                  className="habits-check"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={habit.label}
                  disabled={busy}
                  onClick={() => void handleToggle(habit.key)}
                >
                  {on && <CheckIcon size={16} />}
                </button>
                <span className="habits-row-text">
                  <span className="habits-row-label">{habit.label}</span>
                  <span className="habits-row-hint">{habit.hint}</span>
                </span>
                {habit.target && (
                  <button
                    type="button"
                    className="habits-open"
                    aria-label={habit.targetLabel}
                    onClick={() => onNavigate(habit.target as NavKey)}
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </article>

      <article className="habits-panel">
        <h3>Seus últimos dias</h3>
        <ul className="habits-history" aria-label="Hábitos concluídos por dia">
          {days.map((day) => {
            const count = counts.get(day) ?? 0
            return (
              <li
                key={day}
                className={`habits-history-day${count > 0 ? ' has-checks' : ''}`}
                title={`${dayLabel(day)}: ${count} de ${HABITS.length}`}
                aria-label={`${dayLabel(day)}: ${count} de ${HABITS.length} hábitos`}
              >
                <span aria-hidden="true">{parseIso(day).day}</span>
                <span className="habits-history-bar" aria-hidden="true" style={{ height: `${(count / HABITS.length) * 100}%` }} />
              </li>
            )
          })}
        </ul>
      </article>
    </section>
  )
}
