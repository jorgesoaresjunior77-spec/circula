export interface CommunityChallenge {
  id: string
  community_id: string
  title: string
  description: string | null
  /** URL publica da capa (bucket `avatars`, path `${uid}/covers/...`). `null` = sem capa. */
  cover_image_url: string | null
  /** Inicio do desafio, 'YYYY-MM-DD'. Base do calendario de liberacao dos dias. */
  starts_on: string
  /** Fim do desafio, 'YYYY-MM-DD'. `null` so em linhas legadas sem backfill. */
  ends_on: string | null
  /**
   * Pontos concedidos ao concluir o desafio inteiro. Fase 6 apenas
   * ARMAZENA este valor (a Nutri configura); a concessao/soma acontece
   * na Fase 7.
   */
  completion_points: number
  /**
   * Pontos concedidos por dia concluido. Fase 6 apenas ARMAZENA; a
   * concessao/soma acontece na Fase 7.
   */
  per_day_points: number
  is_active: boolean
  created_by: string
  created_at: string
}

export interface ChallengeActivity {
  id: string
  challenge_id: string
  day_number: number
  content: string
}

export interface ChallengeWithActivities extends CommunityChallenge {
  activities: ChallengeActivity[]
}

export interface ChallengeParticipant {
  id: string
  challenge_id: string
  profile_id: string
  joined_at: string
}

export interface ChallengeProgressEntry {
  id: string
  challenge_id: string
  profile_id: string
  day_number: number
  completed_at: string
  /** Reservado Fase 7 — sempre 0 na Fase 6. */
  points_awarded: number
}

/** Conclusao do desafio por participante (tabela `challenge_completions`). */
export interface ChallengeCompletion {
  id: string
  challenge_id: string
  profile_id: string
  completed_at: string
  /** Reservado Fase 7 — sempre 0 na Fase 6. */
  points_awarded: number
}

export interface ChallengeCommentAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface ChallengeComment {
  id: string
  challenge_id: string
  author_id: string
  content: string
  created_at: string
  author: ChallengeCommentAuthor | null
}

/** Rascunho de um dia do desafio no ChallengeManager. `id` presente = dia ja persistido. */
export interface ChallengeActivityDraft {
  id?: string
  day_number: number
  content: string
}

/** Campos do desafio editaveis pela Nutri (fora as atividades). */
export interface ChallengeDetailsInput {
  title: string
  description: string
  coverImageUrl: string
  startsOn: string
  completionPoints: number
  perDayPoints: number
}

export type ChallengeResult = { error: string | null }
export type JoinChallengeResult = { error: string | null }
export type ToggleProgressResult = { error: string | null }
export type ChallengeCommentResult = { error: string | null }
