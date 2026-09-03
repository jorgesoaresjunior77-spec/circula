// Fase 5 — PEDIDO DE AJUDA.
//
// Estrutura própria (help_requests / help_request_replies), separada de
// posts/Feed, daily_mood, joy_moments e check-in.

export type HelpAudience = 'nutri' | 'community'
export type HelpStatus = 'open' | 'in_progress' | 'resolved'

export const HELP_AUDIENCE_LABEL: Record<HelpAudience, string> = {
  nutri: 'Falar com a Nutri',
  community: 'Pedir para a comunidade',
}

export const HELP_STATUS_LABEL: Record<HelpStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Respondido',
}

export interface HelpPerson {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface HelpRequest {
  id: string
  community_id: string
  profile_id: string
  audience: HelpAudience
  body: string
  status: HelpStatus
  related_conversation_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolved_by: string | null
  author: HelpPerson | null
}

export interface HelpRequestReply {
  id: string
  help_request_id: string
  profile_id: string
  body: string
  created_at: string
  author: HelpPerson | null
}

export interface HelpRequestInput {
  body: string
  audience: HelpAudience
}

export type HelpResult = { error: string | null }
