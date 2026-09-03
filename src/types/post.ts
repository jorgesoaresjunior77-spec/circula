export interface PostAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type PostType = 'standard' | 'daily_question' | 'checkin_share' | 'engagement_command'

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
