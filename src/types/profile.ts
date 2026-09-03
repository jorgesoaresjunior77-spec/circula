export type UserRole = 'master' | 'professional' | 'member'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  interests: string[]
  bio: string | null
  city: string | null
}

export interface ProfileUpdateInput {
  full_name?: string | null
  interests?: string[]
  bio?: string | null
  city?: string | null
}

export interface ProfileOverview {
  posts: number
  comments: number
  circles: number
  challenges: number
  content: number
  events: number
}
