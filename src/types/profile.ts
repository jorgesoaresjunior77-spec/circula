export type UserRole = 'master' | 'professional' | 'member'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  interests: string[]
}
