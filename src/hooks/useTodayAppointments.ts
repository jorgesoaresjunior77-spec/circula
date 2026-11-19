import { useCallback, useMemo, useState } from 'react'
import { useAppointments } from './useAppointments'
import type { Appointment } from './useAppointments'

// Compromissos de hoje da própria pessoa, para o sino e para o ponto vermelho do
// card da Agenda. O "lido" (por compromisso, por dia) fica só neste aparelho.

const STORAGE_KEY = 'circula.agendaBell.read'

function dayBounds(): { from: string; to: string; day: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const day = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`
  return { from: start.toISOString(), to: end.toISOString(), day }
}

function loadRead(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(-80) : []
  } catch {
    return []
  }
}

export function useTodayAppointments(profileId: string | null) {
  const bounds = useMemo(dayBounds, [])
  const { items } = useAppointments(profileId, bounds.from, bounds.to)
  const [read, setRead] = useState<string[]>(loadRead)

  const keyOf = useCallback((a: Appointment) => `${bounds.day}:${a.id}`, [bounds.day])
  const appointments = useMemo(() => items.map((a) => ({ ...a, read: read.includes(`${bounds.day}:${a.id}`) })), [items, read, bounds.day])

  const markRead = useCallback(
    (ids: string[]) => {
      setRead((prev) => {
        const next = [...new Set([...prev, ...ids.map((id) => `${bounds.day}:${id}`)])].slice(-80)
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* sem armazenamento: some só nesta sessão */
        }
        return next
      })
    },
    [bounds.day],
  )

  return {
    appointments,
    hasToday: items.length > 0,
    unreadCount: appointments.filter((a) => !a.read).length,
    markRead,
    keyOf,
  }
}
