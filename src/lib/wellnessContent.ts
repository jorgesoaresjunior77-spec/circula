// Dicas de Leitura e Respiração e Meditação — conteúdo cadastrado pela
// profissional da comunidade. O app não traz nenhum livro, técnica ou
// áudio pronto: tudo vem do que ela publica.

export type ReadingTheme =
  | 'longevidade'
  | 'neurociencia'
  | 'saude'
  | 'desenvolvimento_pessoal'
  | 'inteligencia_emocional'
  | 'habitos_comportamento'
  | 'qualidade_de_vida'

export const READING_THEMES: { key: ReadingTheme; label: string }[] = [
  { key: 'longevidade', label: 'Longevidade' },
  { key: 'neurociencia', label: 'Neurociência' },
  { key: 'saude', label: 'Saúde' },
  { key: 'desenvolvimento_pessoal', label: 'Desenvolvimento pessoal' },
  { key: 'inteligencia_emocional', label: 'Inteligência emocional' },
  { key: 'habitos_comportamento', label: 'Hábitos e comportamento' },
  { key: 'qualidade_de_vida', label: 'Qualidade de vida' },
]

export type SessionKind = 'respiracao' | 'meditacao' | 'relaxamento' | 'pausa'

export const SESSION_KINDS: { key: SessionKind; label: string }[] = [
  { key: 'respiracao', label: 'Respiração guiada' },
  { key: 'meditacao', label: 'Meditações curtas' },
  { key: 'relaxamento', label: 'Áudios de relaxamento' },
  { key: 'pausa', label: 'Pausas e desaceleração' },
]

export type PublishStatus = 'draft' | 'published'

export interface ReadingTip {
  id: string
  community_id: string
  theme: ReadingTheme
  title: string
  author: string
  summary: string | null
  key_learnings: string | null
  why_recommended: string | null
  cover_image_url: string | null
  status: PublishStatus
}

export interface WellnessSession {
  id: string
  community_id: string
  kind: SessionKind
  title: string
  instructions: string | null
  duration_minutes: number
  audio_url: string | null
  status: PublishStatus
}

export function themeLabel(theme: string): string {
  return READING_THEMES.find((t) => t.key === theme)?.label ?? theme
}

export function kindLabel(kind: string): string {
  return SESSION_KINDS.find((k) => k.key === kind)?.label ?? kind
}

/** "5 min" / "1 h" / "1 h 30 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Só links https são aceitos como áudio (o banco repete a regra). */
export function isValidAudioUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
