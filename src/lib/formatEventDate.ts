// Formatação de data/hora de evento em pt-BR. Sem dependência nova —
// usa Intl nativo. Ex.: "sáb, 6 de set · 14:00"
const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const TIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatEventDate(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return ''

  const datePart = DATE_FMT.format(start).replace(/\.$/, '')
  const startTime = TIME_FMT.format(start)

  if (endsAt) {
    const end = new Date(endsAt)
    if (!Number.isNaN(end.getTime())) {
      const sameDay = start.toDateString() === end.toDateString()
      const endTime = TIME_FMT.format(end)
      if (sameDay) return `${datePart} · ${startTime}–${endTime}`
      const endDate = DATE_FMT.format(end).replace(/\.$/, '')
      return `${datePart} ${startTime} → ${endDate} ${endTime}`
    }
  }

  return `${datePart} · ${startTime}`
}

export function isPastEvent(startsAt: string, endsAt?: string | null): boolean {
  const reference = endsAt ? new Date(endsAt) : new Date(startsAt)
  if (Number.isNaN(reference.getTime())) return false
  return reference.getTime() < Date.now()
}

/** Valor para <input type="datetime-local"> a partir de um ISO. */
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** ISO a partir do valor de <input type="datetime-local"> (hora local). */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
