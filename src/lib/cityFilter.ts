import { cityNormalize } from './city'
import type { CityCategory, CityListing } from './city'

export type GuideSort = 'indicados' | 'recentes'

export interface GuideFilter {
  group: string | null
  categoryId: string | null
  query: string
  tagIds: string[]
  price: string | null
  sort: GuideSort
}

/** Filtra e ordena os cadastros do Guia da cidade (lugares e profissionais). */
export function filterGuide(list: CityListing[], categories: CityCategory[], f: GuideFilter): CityListing[] {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const q = cityNormalize(f.query)
  const out = list.filter((l) => {
    const cat = l.categoria_id ? catById.get(l.categoria_id) : undefined
    if (f.group && cat?.grupo !== f.group) return false
    if (f.categoryId && l.categoria_id !== f.categoryId) return false
    if (f.price && l.faixa_preco !== f.price) return false
    if (f.tagIds.length > 0 && !f.tagIds.every((t) => l.tags.includes(t))) return false
    if (q) {
      const haystack = cityNormalize(`${l.titulo} ${cat?.nome ?? ''} ${l.bairro ?? ''}`)
      if (!haystack.includes(q)) return false
    }
    return true
  })
  return out.sort((a, b) =>
    f.sort === 'indicados'
      ? b.votos - a.votos || Date.parse(b.criado_em) - Date.parse(a.criado_em)
      : Date.parse(b.criado_em) - Date.parse(a.criado_em),
  )
}

/** Quantos cadastros cada categoria tem (só as que têm algum). */
export function countByCategory(list: CityListing[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of list) if (l.categoria_id) m.set(l.categoria_id, (m.get(l.categoria_id) ?? 0) + 1)
  return m
}

/** Quantos cadastros cada grupo tem. */
export function countByGroup(list: CityListing[], categories: CityCategory[]): Map<string, number> {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const m = new Map<string, number>()
  for (const l of list) {
    const g = l.categoria_id ? catById.get(l.categoria_id)?.grupo : undefined
    if (g) m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

/** Eventos/convites: os que ainda não passaram primeiro (por data), depois os passados. */
export function splitUpcoming(list: CityListing[], now = Date.now()): { upcoming: CityListing[]; past: CityListing[] } {
  const dayAgo = now - 24 * 3600 * 1000
  const byDate = (a: CityListing, b: CityListing) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? '')
  const upcoming = list.filter((l) => l.starts_at && Date.parse(l.starts_at) >= dayAgo).sort(byDate)
  const past = list.filter((l) => !l.starts_at || Date.parse(l.starts_at) < dayAgo).sort((a, b) => byDate(b, a))
  return { upcoming, past }
}
