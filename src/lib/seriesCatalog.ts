// Dicas de Séries / Filmes: gêneros, classificação indicativa e plataformas.
// O Círcula indica o conteúdo; a pessoa assiste na plataforma (que ela assina à parte).

export const SERIES_GENRES = [
  'Drama',
  'Comédia',
  'Romance',
  'Suspense',
  'Terror',
  'Documentário',
  'Aventura',
  'Ficção científica',
  'Inspiradores',
  'Família',
  'Biografia',
  'Desenvolvimento pessoal',
  'Mistério',
  'História',
  'Saúde e bem-estar',
  'Espiritualidade',
  'Superação',
  'Autoconhecimento',
] as const

export const AGE_RATINGS = ['L', '10', '12', '14', '16', '18'] as const
export type AgeRating = (typeof AGE_RATINGS)[number]

export const PLATFORMS = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Globoplay', 'Apple TV+', 'Paramount+', 'Telecine', 'YouTube', 'Cinema'] as const

export type PickKind = 'serie' | 'filme'
export const KIND_LABEL: Record<PickKind, string> = { serie: 'Séries', filme: 'Filmes' }

export interface SeriesPick {
  id: string
  kind: PickKind
  title: string
  description: string | null
  genres: string[]
  platform: string | null
  platform_url: string | null
  age_rating: AgeRating | null
  cover_path: string | null
  status: 'draft' | 'published'
}

/** Só abre links https (nunca javascript:, data: ou http solto). */
export function safeWatchLink(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function ageLabel(r: string | null): string | null {
  if (!r) return null
  return r === 'L' ? 'Livre' : `${r} anos`
}

export function filterPicks(items: SeriesPick[], opts: { kind: PickKind; genre?: string | null }): SeriesPick[] {
  return items.filter((p) => p.kind === opts.kind && (!opts.genre || p.genres.includes(opts.genre)))
}
