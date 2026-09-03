// Fase 10 — Conquistas da usuária.
//
// DERIVADAS de dados que a Member já lê pela RLS (point_accounts,
// challenge_completions, challenge_progress, joy_moments,
// community_members.joined_at). Sem tabela nova, sem view, sem migration,
// sem RLS nova. Nenhum motor configurável — as regras são fixas aqui.

export type AchievementGroup = 'points' | 'challenges' | 'days' | 'time' | 'joy'

export interface Achievement {
  id: string
  group: AchievementGroup
  /** Emoji do selo — leve, celebratório, não infantil. */
  icon: string
  title: string
  description: string
  unlocked: boolean
  /** Valor atual da métrica (p/ a barra de "próxima conquista"). */
  current: number
  /** Alvo do marco. */
  target: number
}

export const POINT_MILESTONES = [50, 100, 250, 500, 1000] as const
export const CHALLENGE_MILESTONES = [1, 3, 5] as const
export const DAY_MILESTONES = [10, 30] as const
/** meses de casa */
export const TIME_MILESTONES = [1, 6, 12] as const
