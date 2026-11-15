import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppointments } from '../hooks/useAppointments'
import { CloseIcon } from './icons'

// Compromissos de hoje: ao entrar no Círcula, um pop-up lista tudo o que a
// pessoa anotou na Agenda para o dia. Aparece uma vez por dia neste aparelho
// (depois da mensagem do dia) e só quando há compromisso — sem nada marcado,
// não aparece nada.

interface TodayAgendaPopupProps {
  profileId: string
  /** A mensagem do dia já saiu de cena e nenhum outro modal está aberto. */
  ready: boolean
  onOpenAgenda: () => void
}

function dayBounds(): { from: string; to: string; key: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const key = `circula:agenda-popup:${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`
  return { from: start.toISOString(), to: end.toISOString(), key }
}

function seenToday(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function hourOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function TodayAgendaPopup({ profileId, ready, onOpenAgenda }: TodayAgendaPopupProps) {
  const bounds = useMemo(dayBounds, [])
  const [closed, setClosed] = useState(() => seenToday(bounds.key))
  // Já visto hoje: nem consulta.
  const { items } = useAppointments(closed ? null : profileId, bounds.from, bounds.to)

  if (closed || !ready || items.length === 0) return null

  function close() {
    try {
      localStorage.setItem(bounds.key, '1')
    } catch {
      /* sem storage: some só nesta visita */
    }
    setClosed(true)
  }

  return createPortal(
    <div className="inspiration-popup-backdrop" onClick={close}>
      <aside
        className="agenda-popup"
        role="dialog"
        aria-modal="true"
        aria-label="Seus compromissos de hoje"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="inspiration-popup-close" onClick={close} aria-label="Fechar compromissos de hoje">
          <CloseIcon size={16} />
        </button>
        <p className="agenda-popup-eyebrow">Sua agenda de hoje</p>
        <h3 className="agenda-popup-title">
          {items.length === 1 ? 'Você tem 1 compromisso' : `Você tem ${items.length} compromissos`}
        </h3>
        <ul className="agenda-popup-list">
          {items.map((a) => (
            <li key={a.id}>
              <span className="agenda-popup-hour">{a.all_day ? 'Dia todo' : hourOf(a.starts_at)}</span>
              <span className="agenda-popup-text">
                <strong>{a.title}</strong>
                {a.notes && <small>{a.notes}</small>}
              </span>
            </li>
          ))}
        </ul>
        <div className="agenda-popup-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              close()
              onOpenAgenda()
            }}
          >
            Abrir a agenda
          </button>
          <button type="button" className="auth-link" onClick={close}>
            Fechar
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
