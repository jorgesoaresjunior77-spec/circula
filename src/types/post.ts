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
