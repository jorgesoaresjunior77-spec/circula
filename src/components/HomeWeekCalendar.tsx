import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { WEEKDAY_LABELS, todayParts, weekDays, weekTitle } from '../lib/weekCalendar'

// Calendário compacto da Home — sem card, sem fundo próprio: só a
// informação sobre a tela. Mostra mês e ano, os dias da semana de segunda
// a domingo e os números, com o dia de hoje destacado.
//
// A área inteira abre a agenda (um único botão cobre tudo, sem botão
// extra). As duas setas ficam por cima desse botão e só trocam de semana.

interface HomeWeekCalendarProps {
  onOpen: () => void
}

export function HomeWeekCalendar({ onOpen }: HomeWeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const today = useMemo(() => todayParts(), [])
  const days = useMemo(() => weekDays(today, weekOffset), [today, weekOffset])
  const title = weekTitle(days)

  return (
    <section className="home-week" aria-label="Calendário da semana">
      <span className="home-week-eyebrow">Agenda</span>
      <button
        type="button"
        className="home-week-open"
        onClick={onOpen}
        aria-label={`Abrir agenda. Semana de ${title}`}
      >
        <span className="home-week-title">{title}</span>
        <span className="home-week-grid" aria-hidden="true">
          {days.map((d, i) => (
            <span key={`l-${d.iso}`} className="home-week-weekday" style={{ gridColumn: i + 1, gridRow: 1 }}>
              {WEEKDAY_LABELS[i]}
            </span>
          ))}
          {days.map((d, i) => (
            <span
              key={`n-${d.iso}`}
              className={`home-week-day${d.isToday ? ' home-week-day--today' : ''}`}
              style={{ gridColumn: i + 1, gridRow: 2 }}
            >
              {d.day}
            </span>
          ))}
        </span>
      </button>

      <button
        type="button"
        className="home-week-arrow home-week-arrow--prev"
        onClick={() => setWeekOffset((n) => n - 1)}
        aria-label="Semana anterior"
      >
        <ChevronLeftIcon size={18} />
      </button>
      <button
        type="button"
        className="home-week-arrow home-week-arrow--next"
        onClick={() => setWeekOffset((n) => n + 1)}
        aria-label="Próxima semana"
      >
        <ChevronRightIcon size={18} />
      </button>
    </section>
  )
}
