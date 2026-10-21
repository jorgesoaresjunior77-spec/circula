import type { GardenColor } from './profile'

export type GardenChallengeStatus = 'draft' | 'published' | 'archived'

export interface GardenChallenge {
  id: string
  community_id: string
  created_by: string
  title: string
  description: string | null
  status: GardenChallengeStatus
  duration_days: number
  starts_on: string
  enrollment_opens_at: string | null
  enrollment_closes_at: string | null
  allow_late_enrollment: boolean
  cover_image_url: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface GardenChallengeDay {
  id: string
  challenge_id: string
  day_number: number
  activity_date: string
  title: string
  instructions: string | null
  icon: string | null
  encouragement_message: string | null
  created_at: string
  updated_at: string
}

export interface GardenEnrollment {
  id: string
  challenge_id: string
  profile_id: string
  enrolled_at: string
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface GardenCompletion {
  id: string
  challenge_id: string
  challenge_day_id: string
  enrollment_id: string
  profile_id: string
  completed_at: string
}

/**
 * Uma entrada de "Meu histórico" (Member) — um desafio ARQUIVADO no qual
 * a própria pessoa tem pelo menos um compartilhamento. Construída 100%
 * a partir do snapshot congelado em `garden_shares` (nunca de
 * `garden_challenges`/`garden_challenge_days`, que a RLS não deixa um
 * Member comum ler quando o desafio já não está mais `published`) — ver
 * useGardenMember.fetchHistory. Por isso NÃO cobre conclusões que nunca
 * foram compartilhadas em um desafio hoje arquivado: sem uma linha de
 * `garden_shares`, não há título/duração acessível para exibir, e este
 * tipo não inventa esse dado.
 */
export interface GardenHistoryEntry {
  challengeId: string
  challengeTitle: string
  daysCompleted: number
  totalDays: number
  colorOne: GardenColor | null
  colorTwo: GardenColor | null
  lastSharedAt: string
}

/** Formato cru de uma linha de `garden_shares` usada para montar o histórico (ver buildGardenHistory). */
export interface GardenShareHistoryRow {
  challenge_id: string
  challenge_title: string
  days_completed: number
  total_days: number
  color_one: string | null
  color_two: string | null
  created_at: string
}

/**
 * Função pura (sem Supabase, sem React) — separada de
 * useGardenMember.fetchHistory só para poder testar a regra de negócio
 * isoladamente: "um desafio entra no histórico só se NÃO estiver mais
 * publicado, e só com o compartilhamento mais recente dele".
 *
 * Pré-condição do chamador: `shareRows` já vem ordenado por
 * `created_at` DESCENDENTE (mesma ordem que a query em
 * useGardenMember.fetchHistory já pede ao Supabase) — é o que garante
 * que "a primeira ocorrência de cada challenge_id" seja a mais recente.
 */
export function buildGardenHistory(
  shareRows: readonly GardenShareHistoryRow[],
  stillPublishedChallengeIds: ReadonlySet<string>,
): GardenHistoryEntry[] {
  const byChallenge = new Map<string, GardenHistoryEntry>()

  for (const row of shareRows) {
    if (stillPublishedChallengeIds.has(row.challenge_id)) continue // ainda publicado — não é "histórico"
    if (byChallenge.has(row.challenge_id)) continue // já guardamos o compartilhamento mais recente deste desafio

    byChallenge.set(row.challenge_id, {
      challengeId: row.challenge_id,
      challengeTitle: row.challenge_title,
      daysCompleted: row.days_completed,
      totalDays: row.total_days,
      colorOne: row.color_one as GardenColor | null,
      colorTwo: row.color_two as GardenColor | null,
      lastSharedAt: row.created_at,
    })
  }

  return [...byChallenge.values()]
}

/** Formulário de criação/edição do desafio (Painel · Meu Jardim). */
export interface GardenChallengeInput {
  title: string
  description: string | null
  duration_days: number
  starts_on: string
  enrollment_opens_at: string | null
  enrollment_closes_at: string | null
  allow_late_enrollment: boolean
  cover_image_url: string | null
}

/** Edição individual de um dia já gerado. */
export interface GardenChallengeDayInput {
  title: string
  instructions: string | null
  icon: string | null
  encouragement_message: string | null
  activity_date: string
}

export const GARDEN_COLORS: GardenColor[] = [
  'sage',
  'rose',
  'peach',
  'lavender',
  'sky',
  'sand',
  'terracotta',
]

export const GARDEN_COLOR_LABEL: Record<GardenColor, string> = {
  sage: 'Sálvia',
  rose: 'Rosé',
  peach: 'Pêssego',
  lavender: 'Lavanda',
  sky: 'Céu',
  sand: 'Areia',
  terracotta: 'Terracota',
}

export const GARDEN_COLOR_HEX: Record<GardenColor, string> = {
  sage: '#93a186',
  rose: '#b98f8f',
  peach: '#e0b198',
  lavender: '#b3a7c7',
  sky: '#9db3bd',
  sand: '#c9b48f',
  terracotta: '#c17b5a',
}

export type GardenResult = { error: string | null }

const GARDEN_ERROR_LABEL: Record<string, string> = {
  challenge_not_found: 'Desafio não encontrado.',
  not_authorized: 'Você não tem permissão para esta ação.',
  challenge_not_draft: 'Só é possível fazer isso enquanto o desafio está em rascunho.',
  challenge_has_no_days: 'Cadastre pelo menos um dia antes de publicar.',
  challenge_not_published: 'Este desafio ainda não foi publicado.',
  challenge_archived_is_final: 'Um desafio arquivado não pode voltar a rascunho/publicado.',
  not_authenticated: 'Sessão expirada. Entre novamente.',
  day_not_found: 'Atividade não encontrada.',
  day_not_released: 'Esta atividade ainda não foi liberada.',
  not_enrolled: 'Participe do desafio para marcar atividades.',
  message_required: 'Escreva uma mensagem antes de publicar.',
  completion_not_found: 'Conclusão não encontrada.',
  already_shared: 'Esta conclusão já foi compartilhada no feed.',
}

const GARDEN_FALLBACK_ERROR = 'Não foi possível concluir a ação agora. Tente novamente.'

/**
 * Traduz o `message` de uma exceção do Postgres (`raise exception
 * 'codigo'`) para um texto amigável. Usa correspondência por SUBSTRING
 * (`.includes`), não igualdade exata — o `message` que chega via
 * PostgREST/supabase-js não é garantido ser o código cru, sem nenhum
 * texto ao redor (mesmo cuidado já tomado por `mapError` em
 * usePostsModeration.ts para os erros de `moderate_post`).
 */
export function gardenErrorMessage(raw: string | null | undefined): string {
  if (!raw) return GARDEN_FALLBACK_ERROR
  for (const code of Object.keys(GARDEN_ERROR_LABEL)) {
    if (raw.includes(code)) return GARDEN_ERROR_LABEL[code]
  }
  return GARDEN_FALLBACK_ERROR
}
