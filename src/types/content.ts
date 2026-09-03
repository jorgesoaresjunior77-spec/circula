export type ContentType =
  | 'recipe'
  | 'article'
  | 'tip'
  | 'material'
  | 'video'
  | 'educational'

export type ContentStatus = 'draft' | 'published' | 'archived'

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  recipe: 'Receita',
  article: 'Artigo',
  tip: 'Dica',
  material: 'Material',
  video: 'Vídeo',
  educational: 'Conteúdo educativo',
}

// Fase 2 — RECEITAS.
// Categorias de receita são CLASSIFICAÇÃO DE INTERFACE, não constraint de
// banco: ficam guardadas na coluna livre `community_content.category` e
// esta lista só dita as opções mostradas e os filtros. Para adicionar
// uma categoria nova no futuro, basta incluir aqui — nenhuma migration.
export const RECIPE_CATEGORIES = [
  'Café da manhã',
  'Almoço',
  'Jantar',
  'Lanches',
  'Sobremesas',
  'Bebidas',
  'Outras',
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]

export const RECIPE_CATEGORY_FALLBACK: RecipeCategory = 'Outras'

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
  /** Fase 2 — ingredientes da receita (texto livre, 1 por linha). Nulo
   *  para conteúdos que não são receita. Coluna aditiva `recipe_fields`. */
  ingredients: string | null
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
  ingredients?: string | null
  circle_id?: string | null
  status?: ContentStatus
}

export type ContentResult = { error: string | null }

// Fase 2 — entrada do formulário de receita. Subconjunto de ContentInput
// com `type` fixo em 'recipe'; sem `external_url` nem `circle_id` (a
// receita é sempre da comunidade toda — cadastro simples).
export interface RecipeInput {
  title: string
  summary?: string | null
  body?: string | null
  cover_image_url?: string | null
  category?: string | null
  ingredients?: string | null
  status?: ContentStatus
}
