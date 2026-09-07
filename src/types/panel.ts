// Fase 8 — tipos do Painel Professional (dados agregados que só a Nutri
// consulta, sempre no escopo da própria comunidade).

/** Linha da aba de moderação de publicações (RPC community_posts_moderation). */
export interface ModerationPost {
  id: string
  author_id: string
  author_name: string | null
  author_avatar: string | null
  content: string
  title: string | null
  post_type: string
  image_url: string | null
  circle_id: string | null
  created_at: string
  /** `null` = visível; timestamp = oculta. */
  hidden_at: string | null
  reaction_count: number
  comment_count: number
}

export type ModeratePostAction = 'hide' | 'unhide' | 'remove'
export type ModeratePostResult = { error: string | null }

/** Participante na visão consolidada (RPC community_participants_overview). Sem humor. */
export interface ParticipantOverview {
  profile_id: string
  full_name: string | null
  avatar_url: string | null
  status: string
  joined_at: string
  balance: number
  challenges_completed: number
  challenge_days_done: number
  last_activity_at: string | null
}

/** Métricas ampliadas montadas no cliente a partir de fontes reais existentes. */
export interface PanelExtraMetrics {
  events_upcoming: number
  events_total_period: number
  content_published: number
  challenge_completions_period: number
  joy_moments_period: number
  help_open: number
  help_in_progress: number
  help_resolved: number
  points_period: number
  points_all_time: number
}

export interface DashboardEvent {
  id: string
  title: string
  starts_at: string
}

export interface DashboardPost {
  id: string
  content: string
  created_at: string
  author_name: string | null
}

export interface DashboardTopEarner {
  profile_id: string
  full_name: string | null
  balance: number
}

/** 16.2.3-E — item da timeline "Atividade recente" (Visão geral). */
export type DashboardActivityKind =
  | 'member_joined'
  | 'challenge_created'
  | 'content_published'

export interface DashboardActivityItem {
  /** `${kind}:${rowId}` — chave estável de render. */
  id: string
  kind: DashboardActivityKind
  /** ISO — usado só para ordenar a timeline. */
  at: string
  actor_name: string | null
  summary: string
}

/** Payload da Home do painel (useProfessionalDashboard). */
export interface ProfessionalDashboardData {
  members_total: number
  members_active: number
  members_inactive: number
  members_new: number
  help_pending: number
  challenges_active: number
  /** 16.2.3-F — desafios ativos terminando em até 3 dias. */
  challenges_ending_soon: number
  /** 16.2.3-F — o próximo evento (upcoming_events[0]) ocorre em ≤ 24 h. */
  next_event_within_24h: boolean
  points_period: number
  points_all_time: number
  posts_count: number
  comments_count: number
  reactions_count: number
  upcoming_events: DashboardEvent[]
  recent_posts: DashboardPost[]
  top_earners: DashboardTopEarner[]
  recent_activity: DashboardActivityItem[]
}
