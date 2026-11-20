// Dicas de Séries / Filmes: gêneros, classificação indicativa e plataformas.
// O Círcula indica o conteúdo; a pessoa assiste na plataforma (que ela assina à parte).

export const SERIES_GENRES = [
  'Ação',
  'Animação',
  'Anime',
  'Aventura',
  'Autoconhecimento',
  'Biografia',
  'Comédia',
  'Comédia romântica',
  'Crime',
  'Culinária',
  'Desenvolvimento pessoal',
  'Documentário',
  'Drama',
  'Drama de época',
  'Espiritualidade',
  'Esporte',
  'Família',
  'Fantasia',
  'Ficção científica',
  'Guerra',
  'História',
  'Infantil',
  'Inspiradores',
  'Juvenil',
  'Medicina e saúde',
  'Mistério',
  'Música',
  'Musical',
  'Natureza',
  'Novela',
  'Policial',
  'Reality show',
  'Religioso',
  'Romance',
  'Saúde e bem-estar',
  'Stand-up',
  'Superação',
  'Suspense',
  'Terror',
  'Thriller psicológico',
  'Viagem',
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

export interface PickFilters {
  /** Vazio/ausente = séries e filmes. */
  kind?: PickKind | '' | null
  genre?: string | null
  age?: string | null
  platform?: string | null
}

export function filterPicks(items: SeriesPick[], opts: PickFilters): SeriesPick[] {
  return items.filter(
    (p) =>
      (!opts.kind || p.kind === opts.kind) &&
      (!opts.genre || p.genres.includes(opts.genre)) &&
      (!opts.age || p.age_rating === opts.age) &&
      (!opts.platform || p.platform === opts.platform),
  )
}
