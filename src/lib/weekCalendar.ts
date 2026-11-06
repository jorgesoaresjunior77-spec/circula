import { getLocalDateParts, GARDEN_DEFAULT_TIMEZONE } from './timezone'

// Semana do calendário compacto da Home. Toda a conta de datas é feita em
// UTC sobre ano/mês/dia "de calendário" (sem hora), então não sofre com o
// fuso do aparelho nem com horário de verão. O "hoje" vem do fuso oficial
// do app (America/Sao_Paulo), a mesma regra do Meu Jardim.

export interface CalendarDay {
  year: number
  month: number // 1-12
  day: number
  /** `YYYY-MM-DD`. */
  iso: string
  isToday: boolean
}

export const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

export const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Hoje, no fuso do app. */
export function todayParts(at: Date = new Date(), timeZone: string = GARDEN_DEFAULT_TIMEZONE) {
  return getLocalDateParts(at, timeZone)
}

/**
 * Os 7 dias (segunda a domingo) da semana que está `weekOffset` semanas
 * de distância da semana de `today`. 0 = esta semana, -1 = a passada.
 */
export function weekDays(
  today: { year: number; month: number; day: number },
  weekOffset = 0,
): CalendarDay[] {
  const base = Date.UTC(today.year, today.month - 1, today.day)
  const dow = new Date(base).getUTCDay() // 0 = domingo
  const sinceMonday = (dow + 6) % 7
  const monday = base - sinceMonday * 86_400_000 + weekOffset * 7 * 86_400_000
  const todayIso = toIso(today.year, today.month, today.day)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + i * 86_400_000)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const iso = toIso(year, month, day)
    return { year, month, day, iso, isToday: iso === todayIso }
  })
}

/**
 * Título da primeira linha. Semana dentro de um mês: "Novembro 2026".
 * Semana que atravessa dois meses: "Outubro · Novembro 2026" (ou, se
 * também atravessa o ano, "Dezembro 2026 · Janeiro 2027").
 */
export function weekTitle(days: CalendarDay[]): string {
  const first = days[0]
  const last = days[days.length - 1]
  if (first.month === last.month && first.year === last.year) {
    return `${MONTH_LABELS[first.month - 1]} ${first.year}`
  }
  if (first.year === last.year) {
    return `${MONTH_LABELS[first.month - 1]} · ${MONTH_LABELS[last.month - 1]} ${first.year}`
  }
  return `${MONTH_LABELS[first.month - 1]} ${first.year} · ${MONTH_LABELS[last.month - 1]} ${last.year}`
}

/** Dia (`YYYY-MM-DD`) -> partes numéricas. */
export function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

/** `YYYY-MM-DD` somando `n` dias (n pode ser negativo). */
export function addDaysIso(iso: string, n: number): string {
  const { year, month, day } = parseIso(iso)
  const d = new Date(Date.UTC(year, month - 1, day) + n * 86_400_000)
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/**
 * Grade do mês, segunda a domingo: cada linha é uma semana; os dias de
 * fora do mês (início e fim da grade) vêm marcados com `inMonth: false`.
 */
export function monthGrid(
  year: number,
  month: number,
  today: { year: number; month: number; day: number },
): (CalendarDay & { inMonth: boolean })[][] {
  const rows: (CalendarDay & { inMonth: boolean })[][] = []
  for (let offset = 0; offset < 6; offset += 1) {
    const week = weekDays({ year, month, day: 1 }, offset)
    // A segunda-feira de uma semana seguinte já caiu no mês que vem: acabou.
    if (offset > 0 && week[0].month !== month) break
    rows.push(
      week.map((d) => ({
        ...d,
        inMonth: d.month === month && d.year === year,
        isToday: d.year === today.year && d.month === today.month && d.day === today.day,
      })),
    )
  }
  return rows
}
