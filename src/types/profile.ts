export type UserRole = 'master' | 'professional' | 'member'

/** Meu Jardim — paleta fixa de cores pessoais (ver profiles_garden_colors_check no banco). */
export type GardenColor =
  | 'sage'
  | 'rose'
  | 'peach'
  | 'lavender'
  | 'sky'
  | 'sand'
  | 'terracotta'

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
  /** Meu Jardim — duas cores pessoais, usadas para congelar a aparência
   *  de um compartilhamento de conclusão no momento em que é feito. */
  garden_color_one: GardenColor | null
  garden_color_two: GardenColor | null
}

export interface ProfileUpdateInput {
  full_name?: string | null
  interests?: string[]
  bio?: string | null
  city?: string | null
  gallery_photos?: string[]
  garden_color_one?: GardenColor | null
  garden_color_two?: GardenColor | null
}

export interface ProfileOverview {
  posts: number
  comments: number
  circles: number
  content: number
  events: number
}
