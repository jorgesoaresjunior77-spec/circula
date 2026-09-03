// Fase 9 — tipos do Painel Master (visão de plataforma).
// Todos os dados aqui são AGREGADOS. Nenhum campo carrega texto de
// conteúdo, profile_id de membro, saldo individual ou humor individual.

export interface PlatformOverview {
  communities_total: number
  communities_active: number
  communities_new_30d: number

  professionals_total: number
  professionals_active: number
  professionals_new_30d: number

  members_total: number
  members_new_30d: number

  users_total: number
  users_new_7d: number
  users_new_30d: number
  users_by_role: Partial<Record<'master' | 'professional' | 'member', number>>

  posts_total: number
  posts_30d: number

  recipes_published: number
  communities_with_recipes: number
  content_published: number

  events_total: number
  events_upcoming: number

  challenges_total: number
  challenges_active: number
  challenge_completions_total: number
  challenge_completions_30d: number
  challenge_days_done_total: number

  help_open: number
  help_in_progress: number
  help_resolved: number
  help_total: number

  joy_moments_total: number
  joy_moments_30d: number

  checkin_responses_total: number

  points_distributed_total: number
  points_distributed_30d: number

  platform_subs_by_status: Record<string, number>
  community_subs_by_status: Record<string, number>
  trials_ending_7d: number
  plans: PlatformPlan[]
  split_professional_percent: number | null
  split_circula_percent: number | null

  generated_at: string
}

export interface PlatformPlan {
  id: string
  subject: string
  code: string
  name: string
  price_cents: number
  billing_cycle: string
  is_active: boolean
}

export interface PlatformCommunity {
  id: string
  name: string
  slug: string
  cover_image_url: string | null
  is_discoverable: boolean
  created_at: string
  owner_id: string
  owner_name: string | null
  owner_avatar: string | null
  subscription_status: string | null
  members_active: number
  members_new_30d: number
  posts_30d: number
  challenge_completions_30d: number
  points_30d: number
  points_total: number
  help_pending: number
  last_activity_at: string | null
}

export interface PlatformProfessional {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  platform_active: boolean
  platform_subscription_status: string | null
  communities_count: number
  members_total: number
  posts_30d: number
  last_activity_at: string | null
}
