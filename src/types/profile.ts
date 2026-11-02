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
  /** Etapa 8/9 (evolução/gamificação) — `undefined` SÓ enquanto a
   *  migration preparada (não aplicada ainda) não tiver rodado no
   *  remoto (ver useAuth.refreshProfile, fallback em cascata); nunca
   *  defina manualmente como `undefined` em código novo — depois da
   *  migration aplicada, é sempre `OnboardingAnswers | null`.
   *  Onboarding/tour NUNCA aparecem enquanto for `undefined` (ver
   *  Dashboard.tsx) — é o sinal de "coluna ainda não existe no banco",
   *  diferente de `null` ("existe, mas ainda não concluído"). */
  onboarding_answers?: OnboardingAnswers | null
  onboarding_completed_at?: string | null
  tour_completed_at?: string | null
}

/** Etapa 8 (evolução/gamificação) — respostas do onboarding. Tudo
 *  opcional: nenhuma pergunta é obrigatória (pedido explícito do
 *  usuário). `interesses` NÃO mora aqui — reaproveita 100%
 *  `profiles.interests` (mesmo array já usado em "Um pouco sobre mim",
 *  ABOUT_ME_OPTIONS), por isso não é campo deste tipo. */
export interface OnboardingAnswers {
  preferred_name?: string
  current_moment?: string
  participation_style?: string[]
  why_joined?: string
  expectations?: string
}

export interface ProfileUpdateInput {
  full_name?: string | null
  interests?: string[]
  bio?: string | null
  city?: string | null
  gallery_photos?: string[]
  garden_color_one?: GardenColor | null
  garden_color_two?: GardenColor | null
  onboarding_answers?: OnboardingAnswers
  onboarding_completed_at?: string
  tour_completed_at?: string
}

export interface ProfileOverview {
  posts: number
  comments: number
  circles: number
  content: number
  events: number
}
