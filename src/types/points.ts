// Fase 7 — sistema de pontos. Pontos sao SEMPRE por comunidade; nenhum
// tipo aqui mistura saldo de comunidades diferentes.

export type PointReason =
  | 'challenge_day'
  | 'challenge_completion'
  | 'recurring_participation'
  | 'manual'

export const POINT_REASON_LABEL: Record<PointReason, string> = {
  challenge_day: 'Dia de desafio concluído',
  challenge_completion: 'Desafio concluído',
  recurring_participation: 'Participação diária',
  manual: 'Concedido pela Nutri',
}

/** Frase curta para o histórico ("descrição" da origem). */
export const POINT_REASON_DESCRIPTION: Record<PointReason, string> = {
  challenge_day: 'Você marcou um dia do desafio.',
  challenge_completion: 'Você concluiu um desafio inteiro.',
  recurring_participation: 'Você registrou seu humor do dia.',
  manual: 'A Nutri concedeu pontos manualmente.',
}

export interface PointAccount {
  id: string
  community_id: string
  profile_id: string
  balance: number
  updated_at: string
}

export interface PointLedgerEntry {
  id: string
  community_id: string
  profile_id: string
  amount: number
  reason: PointReason
  source_type: string | null
  source_id: string | null
  note: string | null
  awarded_by: string | null
  created_at: string
}

export interface PointsProfileRef {
  id: string
  full_name: string | null
  avatar_url: string | null
}

/** Linha do extrato da comunidade (visão da Nutri), com a autora embutida. */
export interface PointLedgerEntryWithProfile extends PointLedgerEntry {
  profile: PointsProfileRef | null
}

/** Saldo de um participante na comunidade (visão da Nutri). */
export interface PointMemberBalance {
  profile: PointsProfileRef
  balance: number
  updated_at: string
}

export interface PointsTopEarner {
  profile_id: string
  full_name: string | null
  avatar_url: string | null
  balance: number
}

export interface PointsCommunitySummary {
  total_points_all_time: number
  total_points_period: number
  period_days: number
  by_reason: Partial<Record<PointReason, number>>
  earners_count: number
  /** `null` quando quem consulta é o Master (só números, sem lista nominal). */
  top_earners: PointsTopEarner[] | null
}

export type AwardManualResult = { error: string | null }
export type RecurringConfigResult = { error: string | null }
