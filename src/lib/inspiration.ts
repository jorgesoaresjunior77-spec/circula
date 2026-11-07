// Pop-up diário de inspiração. O app NÃO traz frase nenhuma: só mostra as
// mensagens que a profissional cadastrou (citação com autor e obra, ou
// texto editorial). Sem mensagem publicada, não há pop-up.

export type InspirationKind = 'citacao' | 'editorial' | 'frase'

export interface Inspiration {
  id: string
  community_id: string
  kind: InspirationKind
  body: string
  author: string | null
  source: string | null
  status: 'draft' | 'published'
  created_at: string
}

/** Dias desde 1970 para uma data `YYYY-MM-DD` (dia de calendário, sem fuso). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Gerador pseudoaleatório pequeno e estável (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A mensagem do dia: sorteada, uma por dia, igual para todo mundo. A lista
 * publicada é embaralhada a cada "rodada" (de N dias, para N mensagens):
 * nenhuma repete antes de todas aparecerem, e a ordem muda de uma rodada
 * para a outra. `null` se não há nenhuma publicada.
 */
export function pickInspiration(items: Inspiration[], todayIso: string): Inspiration | null {
  const published = items
    .filter((i) => i.status === 'published')
    .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1))
  const n = published.length
  if (n === 0) return null
  const day = dayNumber(todayIso)
  const cycle = Math.floor(day / n)
  const rand = seeded(cycle * 2654435761 + n)
  const order = published.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return published[order[day % n]]
}

/** "Autora, Obra" — citação (obra obrigatória) ou frase (só autora, obra
 *  opcional); texto editorial leva o selo do Círcula. */
export function attribution(item: Inspiration): string {
  if (item.kind === 'editorial') return 'Texto editorial do Círcula'
  return [item.author, item.source].filter(Boolean).join(', ')
}

/** Citação e frase aparecem entre aspas; texto editorial, não. */
export function displayBody(item: Inspiration): string {
  return item.kind === 'editorial' ? item.body : '“' + item.body + '”'
}

const SEEN_PREFIX = 'circula:daily-inspiration:'

/** Já mostrou hoje para esta pessoa, neste aparelho? Nunca lança. */
export function wasSeenToday(profileId: string, todayIso: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + profileId) === todayIso
  } catch {
    return false
  }
}

export function markSeenToday(profileId: string, todayIso: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + profileId, todayIso)
  } catch {
    // Sem armazenamento (aba privada): pode reaparecer, nada mais.
  }
}
