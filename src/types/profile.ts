export type UserRole = 'master' | 'professional' | 'member'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  interests: string[]
  bio: string | null
  city: string | null
  /** Perfil (item 10) — até 12 fotos, URLs públicas do bucket `avatars`
   *  (mesmo bucket do avatar), ordem = ordem de exibição na grade. */
  gallery_photos: string[]
}

export interface ProfileUpdateInput {
  full_name?: string | null
  interests?: string[]
  bio?: string | null
  city?: string | null
  gallery_photos?: string[]
}

export interface ProfileOverview {
  posts: number
  comments: number
  circles: number
  content: number
  events: number
}
