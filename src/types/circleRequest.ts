// Etapa 5 (evolução/experiência/gamificação) — Solicitação de novo
// Círculo. Schema real da migration preparada (NÃO aplicada ainda):
// 20261030130000_circle_requests.sql.

export type CircleRequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export interface CircleRequest {
  id: string
  community_id: string
  profile_id: string
  suggested_name: string
  topic: string | null
  reason: string | null
  activities: string | null
  visual_idea: string | null
  notes: string | null
  reference_image_path: string | null
  status: CircleRequestStatus
  professional_note: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  /** Join com profiles — só quando a dona lista (ver useCircleRequests). */
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

/** Formulário do Member — só os campos que ela preenche. */
export interface CircleRequestInput {
  suggested_name: string
  topic: string | null
  reason: string | null
  activities: string | null
  visual_idea: string | null
  notes: string | null
  reference_image_path: string | null
}

export type CircleRequestResult = { error: string | null }

export const CIRCLE_REQUEST_STATUS_LABEL: Record<CircleRequestStatus, string> = {
  pending: 'Recebido',
  reviewing: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
}

const CIRCLE_REQUEST_ERROR_LABEL: Record<string, string> = {
  duplicate: 'Você já tem uma solicitação em análise. Aguarde a resposta antes de enviar outra.',
}

const CIRCLE_REQUEST_FALLBACK_ERROR = 'Não foi possível enviar agora. Tente novamente.'

/**
 * Traduz o erro do Postgres (índice único parcial violado — já existe
 * uma solicitação 'pending' desta pessoa nesta comunidade) para um
 * texto amigável. Mesmo padrão de correspondência por substring de
 * gardenErrorMessage (types/garden.ts) — o `message` que chega via
 * PostgREST não é garantido vir "limpo".
 */
export function circleRequestErrorMessage(raw: string | null | undefined): string {
  if (!raw) return CIRCLE_REQUEST_FALLBACK_ERROR
  if (raw.includes('circle_requests_one_pending_per_member') || raw.includes('duplicate key')) {
    return CIRCLE_REQUEST_ERROR_LABEL.duplicate
  }
  return CIRCLE_REQUEST_FALLBACK_ERROR
}
