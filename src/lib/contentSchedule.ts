// Agenda de conteúdos da profissional: lembretes de quando publicar cada tipo
// de conteúdo no Círcula. Só a dona vê (RLS); nada vai para as membros.

export type ContentType =
  | 'evento'
  | 'loja'
  | 'receitas'
  | 'revista'
  | 'respiracao'
  | 'playlist'
  | 'leitura'
  | 'wellness'
  | 'series'
  | 'outro'

export const CONTENT_TYPES: { key: ContentType; label: string }[] = [
  { key: 'evento', label: 'Evento' },
  { key: 'loja', label: 'Loja' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'revista', label: 'Revista' },
  { key: 'respiracao', label: 'Respiração' },
  { key: 'playlist', label: 'Playlist' },
  { key: 'leitura', label: 'Dicas de leitura' },
  { key: 'wellness', label: 'Wellness' },
  { key: 'series', label: 'Dicas de séries e filmes' },
  { key: 'outro', label: 'Outro' },
]

export function contentTypeLabel(key: string): string {
  return CONTENT_TYPES.find((t) => t.key === key)?.label ?? 'Outro'
}

export type SchedulePhase = 'producao' | 'publicacao'

export const PHASES: { key: SchedulePhase; label: string }[] = [
  { key: 'producao', label: 'Produção' },
  { key: 'publicacao', label: 'Publicação' },
]

export function phaseLabel(key: string): string {
  return PHASES.find((p) => p.key === key)?.label ?? 'Publicação'
}

/** Cor da bolinha no calendário: uma por tipo de conteúdo. */
export const TYPE_COLORS: Record<ContentType, string> = {
  evento: '#c8553d',
  loja: '#d4a017',
  receitas: '#6a994e',
  revista: '#7b5ea7',
  respiracao: '#3a86a8',
  playlist: '#e07a9f',
  leitura: '#8c6a4f',
  wellness: '#2a9d8f',
  series: '#b5651d',
  outro: '#8d8a86',
}

export interface ScheduleItem {
  id: string
  community_id: string
  content_type: ContentType
  phase: SchedulePhase
  title: string
  notes: string | null
  scheduled_on: string // yyyy-mm-dd
  done: boolean
}

export interface ScheduleRules {
  month: string // 'yyyy-mm' ou 'geral'
  production_days: number | null
  posts_per_week: number | null
  frequency: string
  posting_rules: string
  organization: string
}

export const EMPTY_RULES = (month: string): ScheduleRules => ({
  month,
  production_days: null,
  posts_per_week: null,
  frequency: '',
  posting_rules: '',
  organization: '',
})

export const MONTH_NAMES = [
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
]

/** 'yyyy-mm' de um mês (month é 0-11). */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export interface CalendarCell {
  /** yyyy-mm-dd; null nas casas vazias antes do dia 1 e depois do último dia. */
  iso: string | null
  day: number | null
}

/** Grade do mês: semanas de domingo a sábado, com casas vazias nas pontas. */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const cells: CalendarCell[] = []
  for (let i = 0; i < first; i++) cells.push({ iso: null, day: null })
  for (let d = 1; d <= total; d++) {
    cells.push({ iso: `${monthKey(year, month)}-${String(d).padStart(2, '0')}`, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null })
  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Itens agrupados por dia (yyyy-mm-dd). */
export function itemsByDay(items: ScheduleItem[]): Record<string, ScheduleItem[]> {
  const out: Record<string, ScheduleItem[]> = {}
  for (const it of items) (out[it.scheduled_on] ??= []).push(it)
  return out
}

/** Resumo do mês: dias com produção, dias com publicação e total de itens. */
export function monthSummary(
  items: ScheduleItem[],
  key: string,
): { productionDays: number; publishDays: number; total: number } {
  const inMonth = items.filter((i) => i.scheduled_on.startsWith(`${key}-`))
  const days = (phase: SchedulePhase) =>
    new Set(inMonth.filter((i) => i.phase === phase).map((i) => i.scheduled_on)).size
  return { productionDays: days('producao'), publishDays: days('publicacao'), total: inMonth.length }
}

export type ScheduleBucket = 'late' | 'today' | 'upcoming' | 'done'

/** Em qual grupo o item cai, comparando com o dia de hoje (yyyy-mm-dd). */
export function scheduleBucket(item: Pick<ScheduleItem, 'done' | 'scheduled_on'>, today: string): ScheduleBucket {
  if (item.done) return 'done'
  if (item.scheduled_on < today) return 'late'
  if (item.scheduled_on === today) return 'today'
  return 'upcoming'
}

export function groupSchedule(items: ScheduleItem[], today: string): Record<ScheduleBucket, ScheduleItem[]> {
  const out: Record<ScheduleBucket, ScheduleItem[]> = { late: [], today: [], upcoming: [], done: [] }
  for (const it of items) out[scheduleBucket(it, today)].push(it)
  const asc = (a: ScheduleItem, b: ScheduleItem) => a.scheduled_on.localeCompare(b.scheduled_on)
  out.late.sort(asc)
  out.today.sort(asc)
  out.upcoming.sort(asc)
  out.done.sort((a, b) => b.scheduled_on.localeCompare(a.scheduled_on))
  return out
}

/** "17/11" a partir de yyyy-mm-dd, sem passar por fuso. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
