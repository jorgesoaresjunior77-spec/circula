// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
// Tipos do dashboard pessoal. Nenhuma tabela nova: tudo aqui é
// derivado de linhas reais de posts / post_comments / post_reactions /
// circle_members / community_challenges já existentes.

/**
 * Números do bloco "Resumo do dia". Cada campo é uma contagem real; a
 * ausência de dado é representada por 0 (o tile some) e `newMembers` é
 * `null` quando a RPC community_metrics não se aplica ao papel.
 *
 * "novas" aqui significa "dentro de uma janela fixa" (7 dias / 24h),
 * nunca "não vistas" — não existe carimbo de última visita no schema.
 */
export interface HomeSummary {
  /** Comentários de outras pessoas nas publicações da usuária — últimos 7 dias. */
  repliesToMe: number
  /** Reações de outras pessoas nas publicações da usuária — últimos 7 dias. */
  reactionsToMe: number
  /** Publicações novas no feed da comunidade (circle_id nulo) — últimas 24h. */
  newPosts: number
  /** Novas participantes na comunidade — últimos 30 dias. Só para a anfitriã (professional); `null` caso contrário. */
  newMembers: number | null
}

export type HomeActivityKind =
  | 'comment'
  | 'reaction'
  | 'reaction_group'
  | 'new_posts'
  | 'circle_join'

/**
 * Uma linha de "Atividade recente". `at` é o timestamp real usado para
 * ordenar e exibir ("há 2h"). Campos opcionais dependem do `kind`.
 */
export interface HomeActivityItem {
  id: string
  kind: HomeActivityKind
  at: string
  actorName: string | null
  actorAvatarUrl: string | null
  /** reaction_group e new_posts. */
  count?: number
  /** circle_join. */
  circleName?: string
  /** comment — trecho curto do comentário. */
  excerpt?: string
}

export interface HomeTodayData {
  summary: HomeSummary
  recentActivity: HomeActivityItem[]
  loading: boolean
  error: string | null
}
