export interface PostAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type PostType =
  | 'standard'
  | 'daily_question'
  | 'checkin_share'
  | 'engagement_command'
  | 'garden_daily'
  | 'garden_share'

/** Meu Jardim — card editorial da mensagem de incentivo da profissional (post_type='garden_daily'). */
export interface GardenDailyPostSummary {
  id: string
  challenge_id: string
  challenge_day_id: string
  message: string
  /** Vem do join com garden_challenges/garden_challenge_days (dados AO VIVO, não congelados). */
  challenge: { title: string } | null
  challenge_day: {
    day_number: number
    title: string
    icon: string | null
    instructions: string | null
  } | null
}

/** Meu Jardim — card de compartilhamento de conclusão do Member (post_type='garden_share'). Tudo aqui é um SNAPSHOT congelado no momento da publicação. */
export interface GardenShareSummary {
  id: string
  challenge_id: string
  challenge_day_id: string
  challenge_title: string
  day_number: number
  day_title: string
  days_completed: number
  total_days: number
  color_one: string | null
  color_two: string | null
}

export interface Post {
  id: string
  community_id: string
  circle_id: string | null
  author_id: string
  content: string
  image_url: string | null
  created_at: string
  post_type: PostType
  question_id: string | null
  title: string | null
  engagement_command_id: string | null
  author: PostAuthor | null
  /** Presente só quando post_type === 'garden_daily'. */
  garden_daily_post?: GardenDailyPostSummary | null
  /** Presente só quando post_type === 'garden_share'. */
  garden_share?: GardenShareSummary | null
}

export type CreatePostResult = { error: string | null }

export interface CommentAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  /** Nulo => comentário-raiz. Preenchido => resposta a um comentário-raiz. */
  parent_comment_id: string | null
  author: CommentAuthor | null
  /** Preenchido por buildCommentTree em comentários-raiz (respostas agrupadas). */
  replies?: Comment[]
  reply_count?: number
}

export type CreateCommentResult = { error: string | null }
export type ToggleReactionResult = { error: string | null }
