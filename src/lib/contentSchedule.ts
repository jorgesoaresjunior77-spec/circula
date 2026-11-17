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
  { key: 'outro', label: 'Outro' },
]

export function contentTypeLabel(key: string): string {
  return CONTENT_TYPES.find((t) => t.key === key)?.label ?? 'Outro'
}

export interface ScheduleItem {
  id: string
  community_id: string
  content_type: ContentType
  title: string
  notes: string | null
  scheduled_on: string // yyyy-mm-dd
  done: boolean
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
