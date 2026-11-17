// Contas da página de Métricas: crescimento da comunidade e análise de
// visualizações e cliques por dia. Tudo em funções puras (datas no horário
// local, sem passar por fuso), para testar sem banco.

export interface ViewRow {
  kind: string
  item_id: string
  profile_id: string
  created_at: string
}

/** yyyy-mm-dd no horário local. */
export function dayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Os últimos `n` dias (o mais antigo primeiro), terminando em `today`. */
export function lastDays(n: number, today: Date): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)))
  }
  return out
}

export const CLICK_KINDS = ['partner_click']

export function isClick(kind: string): boolean {
  return CLICK_KINDS.includes(kind)
}

/** Quantas linhas caem em cada dia da lista (as que casam com `pick`). */
export function countByDay(rows: ViewRow[], days: string[], pick: (r: ViewRow) => boolean): number[] {
  const index = new Map(days.map((d, i) => [d, i]))
  const out = days.map(() => 0)
  for (const r of rows) {
    if (!pick(r)) continue
    const i = index.get(dayKey(new Date(r.created_at)))
    if (i !== undefined) out[i] += 1
  }
  return out
}

export const sum = (xs: number[]): number => xs.reduce((n, x) => n + x, 0)

/** Variação percentual inteira; null quando não há base de comparação. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export interface GrowthWeek {
  /** "17/11": primeiro dia da semana (segunda). */
  label: string
  joined: number
  /** Total de membros ao fim da semana. */
  total: number
}

function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7 // segunda = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

/** Entradas por semana (segunda a domingo) nas últimas `weeks` semanas. */
export function weeklyGrowth(joinedAt: string[], weeks: number, today: Date): GrowthWeek[] {
  const thisMonday = mondayOf(today)
  const starts: Date[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    starts.push(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7))
  }
  const firstStart = starts[0].getTime()
  const times = joinedAt.map((s) => new Date(s).getTime()).filter((t) => !Number.isNaN(t))
  let running = times.filter((t) => t < firstStart).length
  return starts.map((start, i) => {
    const from = start.getTime()
    const to = i + 1 < starts.length ? starts[i + 1].getTime() : Infinity
    const joined = times.filter((t) => t >= from && t < to).length
    running += joined
    const dd = String(start.getDate()).padStart(2, '0')
    const mm = String(start.getMonth() + 1).padStart(2, '0')
    return { label: `${dd}/${mm}`, joined, total: running }
  })
}

export interface TopItem {
  kind: string
  item_id: string
  views: number
  viewers: number
}

/** Itens mais abertos no conjunto de linhas, com quantas pessoas diferentes. */
export function topItems(rows: ViewRow[], limit: number): TopItem[] {
  const map = new Map<string, { kind: string; item_id: string; views: number; people: Set<string> }>()
  for (const r of rows) {
    const key = `${r.kind}:${r.item_id}`
    let e = map.get(key)
    if (!e) {
      e = { kind: r.kind, item_id: r.item_id, views: 0, people: new Set() }
      map.set(key, e)
    }
    e.views += 1
    e.people.add(r.profile_id)
  }
  return [...map.values()]
    .map((e) => ({ kind: e.kind, item_id: e.item_id, views: e.views, viewers: e.people.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
}

/** Porcentagem inteira de `part` sobre `whole` (0 quando não há base). */
export function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}
