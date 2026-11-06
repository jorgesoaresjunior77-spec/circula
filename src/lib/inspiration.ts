// Pop-up diário de inspiração. O app NÃO traz frase nenhuma: só mostra as
// mensagens que a profissional cadastrou (citação com autor e obra, ou
// texto editorial). Sem mensagem publicada, não há pop-up.

export type InspirationKind = 'citacao' | 'editorial'

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

/**
 * A mensagem do dia: gira pela lista publicada, uma por dia, na mesma
 * ordem para todo mundo. `null` se não há nenhuma publicada.
 */
export function pickInspiration(items: Inspiration[], todayIso: string): Inspiration | null {
  const published = items
    .filter((i) => i.status === 'published')
    .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1))
  if (published.length === 0) return null
  return published[dayNumber(todayIso) % published.length]
}

/** "Autora, Obra" — só para citação; texto editorial leva o selo do Círcula. */
export function attribution(item: Inspiration): string {
  if (item.kind === 'editorial') return 'Texto editorial do Círcula'
  return [item.author, item.source].filter(Boolean).join(', ')
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
