export type ContentType =
  | 'article'
  | 'tip'
  | 'material'
  | 'video'
  | 'educational'

export type ContentStatus = 'draft' | 'published' | 'archived'

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  article: 'Artigo',
  tip: 'Dica',
  material: 'Material',
  video: 'Vídeo',
  educational: 'Conteúdo educativo',
}

export interface ContentLike {
  id: string
  content_id: string
  profile_id: string
  created_at: string
}

export interface CommunityContent {
  id: string
  community_id: string
  circle_id: string | null
  created_by: string
  type: ContentType
  title: string
  summary: string | null
  body: string | null
  cover_image_url: string | null
  external_url: string | null
  category: string | null
  status: ContentStatus
  created_at: string
  updated_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
  likes: ContentLike[]
}

export interface ContentInput {
  type: ContentType
  title: string
  summary?: string | null
  body?: string | null
  cover_image_url?: string | null
  external_url?: string | null
  category?: string | null
  circle_id?: string | null
  status?: ContentStatus
}

export type ContentResult = { error: string | null }
