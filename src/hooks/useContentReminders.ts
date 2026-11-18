import { useCallback, useMemo, useState } from 'react'
import { remindersForToday } from '../lib/contentRules'

// Avisos do sino para a profissional: "amanhã é dia de publicar X", calculados
// das regras fixas (lib/contentRules). Não há o que gravar no servidor: o sino
// só é visto quando ela abre o app. O "lido" fica só neste aparelho.

const STORAGE_KEY = 'circula.contentReminders.read'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadRead(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(-60) : []
  } catch {
    return []
  }
}

export interface ContentReminder {
  key: string
  title: string
  text: string
  read: boolean
}

export function useContentReminders(enabled: boolean) {
  const [read, setRead] = useState<string[]>(() => (enabled ? loadRead() : []))

  const reminders: ContentReminder[] = useMemo(
    () => (enabled ? remindersForToday(todayIso()).map((r) => ({ ...r, read: read.includes(r.key) })) : []),
    [enabled, read],
  )

  const markRead = useCallback((key: string) => {
    setRead((prev) => {
      if (prev.includes(key)) return prev
      const next = [...prev, key].slice(-60)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* sem armazenamento: o aviso só volta a aparecer nesta sessão */
      }
      return next
    })
  }, [])

  const unreadCount = reminders.filter((r) => !r.read).length
  return { reminders, unreadCount, markRead }
}
