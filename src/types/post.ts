export interface PostAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Post {
  id: string
  community_id: string
  author_id: string
  content: string
  created_at: string
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
  author: CommentAuthor | null
}

export type CreateCommentResult = { error: string | null }
export type ToggleReactionResult = { error: string | null }
