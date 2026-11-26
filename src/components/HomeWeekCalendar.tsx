import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { useTodayAppointments } from '../hooks/useTodayAppointments'
import { WEEKDAY_LABELS, todayParts, weekDays, weekTitle } from '../lib/weekCalendar'
import { HOLIDAY_KIND_LABEL, holidaysBetween } from '../lib/feriados'

// Calendário compacto da Home — sem card, sem fundo próprio: só a
// informação sobre a tela. Mostra mês e ano, os dias da semana de segunda
// a domingo e os números, com o dia de hoje destacado.
//
// A área inteira abre a agenda (um único botão cobre tudo, sem botão
// extra). As duas setas ficam por cima desse botão e só trocam de semana.

interface HomeWeekCalendarProps {
  onOpen: () => void
  /** Com a pessoa conhecida, um ponto vermelho avisa que há compromisso hoje. */
  profileId?: string | null
}

export function HomeWeekCalendar({ onOpen, profileId = null }: HomeWeekCalendarProps) {
  const { hasToday } = useTodayAppointments(profileId)
  const [weekOffset, setWeekOffset] = useState(0)
  const today = useMemo(() => todayParts(), [])
  const days = useMemo(() => weekDays(today, weekOffset), [today, weekOffset])
  const title = weekTitle(days)
  // Feriados e pontos facultativos da semana: marcados no número (separados dos compromissos).
  const holidays = useMemo(() => holidaysBetween(days[0].iso, days[days.length - 1].iso), [days])

  return (
    <section className="home-week" aria-label="Calendário da semana">
      <span className="home-week-eyebrow">
        Agenda
        {hasToday && <span className="home-week-alert" role="img" aria-label="Você tem compromisso hoje" />}
      </span>
      <button
        type="button"
        className="home-week-open"
        onClick={onOpen}
        aria-label={`Abrir agenda. Semana de ${title}`}
      >
        {/* Mês e ano numa linha só; semana que pega dois meses ("Novembro ·
            Dezembro 2026") usa letra menor para continuar cabendo. */}
        <span className={`home-week-title${title.length > 16 ? ' home-week-title--long' : ''}`}>{title}</span>
        <span className="home-week-grid" aria-hidden="true">
          {days.map((d, i) => (
            <span key={`l-${d.iso}`} className="home-week-weekday" style={{ gridColumn: i + 1, gridRow: 1 }}>
              {WEEKDAY_LABELS[i]}
            </span>
          ))}
          {days.map((d, i) => (
            <span
              key={`n-${d.iso}`}
              className={`home-week-day${d.isToday ? ' home-week-day--today' : ''}${holidays.get(d.iso) ? ` home-week-day--feriado home-week-day--${holidays.get(d.iso)![0].kind}` : ''}`}
              style={{ gridColumn: i + 1, gridRow: 2 }}
              title={holidays.get(d.iso)?.map((h) => `${h.name} (${HOLIDAY_KIND_LABEL[h.kind]})`).join(', ')}
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
