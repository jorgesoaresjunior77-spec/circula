// Datas de desafio sao 'YYYY-MM-DD' (coluna `date` do Postgres), sem
// hora nem fuso. Formatacao pt-BR e aritmetica simples, sem dependencia
// nova — no mesmo espirito de `lib/formatEventDate.ts`, que cuida das
// datas COM hora dos Eventos.

const DAY_FMT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const DAY_FMT_LONG = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/**
 * Interpreta 'YYYY-MM-DD' como data local (meia-noite). Evita o
 * deslocamento de fuso do `new Date('YYYY-MM-DD')`, que assume UTC.
 */
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** `Date` -> 'YYYY-MM-DD' (componentes locais). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Data de hoje como 'YYYY-MM-DD'. */
export function todayIsoDate(): string {
  return toIsoDate(new Date())
}

/** Soma `days` dias de calendario a uma data 'YYYY-MM-DD'. */
export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate)
  if (!date) return isoDate
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Dias de calendario de hoje ate `isoDate` (negativo se ja passou, 0 = hoje). */
export function daysUntil(isoDate: string): number {
  const target = parseIsoDate(isoDate)
  const today = parseIsoDate(todayIsoDate())
  if (!target || !today) return 0
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Periodo do desafio para leitura: "3 de set – 9 de set", ou apenas
 * "3 de set" quando comeca e termina no mesmo dia (desafio de 1 dia).
 */
export function formatChallengePeriod(startsOn: string, endsOn: string | null): string {
  const start = parseIsoDate(startsOn)
  if (!start) return ''
  const startLabel = DAY_FMT.format(start).replace(/\.$/, '')

  if (!endsOn) return startLabel
  const end = parseIsoDate(endsOn)
  if (!end || start.getTime() === end.getTime()) return startLabel

  const endLabel = DAY_FMT.format(end).replace(/\.$/, '')
  return `${startLabel} – ${endLabel}`
}

/** "hoje", "amanha" ou "3 de setembro" — para o aviso "Comeca ...". */
export function formatStartCountdown(startsOn: string): string {
  const diff = daysUntil(startsOn)
  if (diff <= 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  const start = parseIsoDate(startsOn)
  if (!start) return ''
  return `em ${DAY_FMT_LONG.format(start).replace(/\.$/, '')}`
}
