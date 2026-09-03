// Fase 3 — "Como você está hoje?" (humor diário).
//
// Recurso PRÓPRIO, separado do check-in publicado pela Nutri. O humor
// individual é dado PRIVADO da usuária: só ela lê o próprio registro; a
// Nutri recebe apenas números agregados (nunca quem respondeu o quê).

export type MoodLevel = 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'

/** Ordem do mais triste ao mais feliz — usada para renderizar os rostos. */
export const MOOD_ORDER: MoodLevel[] = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy']

export const MOOD_META: Record<MoodLevel, { emoji: string; label: string }> = {
  very_sad: { emoji: '😢', label: 'Muito triste' },
  sad: { emoji: '🙁', label: 'Para baixo' },
  neutral: { emoji: '😐', label: 'Mais ou menos' },
  happy: { emoji: '🙂', label: 'Bem' },
  very_happy: { emoji: '😄', label: 'Super feliz' },
}

/**
 * Mensagens padrão do sistema — acolhedoras e positivas, nunca clínicas.
 * A Nutri pode substituir cada uma por uma mensagem da comunidade
 * (community_mood_messages); quando não houver override ativo, cai aqui.
 */
export const MOOD_DEFAULT_MESSAGE: Record<MoodLevel, string> = {
  very_sad:
    'Dias difíceis também passam. Você não está sozinha aqui 🤍 Cuide de você com carinho hoje e, se quiser, converse com as outras mulheres do Círcula.',
  sad: 'Tudo bem não estar 100% hoje. Seja gentil com você mesma, faça uma pausa quando precisar — amanhã é uma nova chance.',
  neutral:
    'Um dia tranquilo também é um bom dia. Que tal fazer agora uma pequena coisa boa só para você?',
  happy:
    'Que bom saber que você está bem hoje! Aproveite esse ânimo — e, se puder, espalhe um pouco dele para outra mulher do Círcula.',
  very_happy:
    'Que alegria! 🌸 Dias assim merecem ser celebrados. Guarde esse momento com carinho e, se quiser, compartilhe a sua conquista.',
}

export interface DailyMoodEntry {
  id: string
  profile_id: string
  community_id: string
  mood: MoodLevel
  note: string | null
  entry_date: string
  created_at: string
  updated_at: string
}

/** Override de mensagem cadastrado pela Nutri para a própria comunidade. */
export interface CommunityMoodMessage {
  id: string
  community_id: string
  mood: MoodLevel
  message: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

/** Linha da visão agregada `community_mood_overview` (sem identificação). */
export interface CommunityMoodOverviewRow {
  community_id: string
  mood: MoodLevel
  entry_date: string
  entries: number
}

export type MoodResult = { error: string | null }
