import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface RecipeCategory {
  id: string
  name: string
  description: string | null
  cover_path: string | null
  position: number
}

export interface Recipe {
  id: string
  title: string
  summary: string | null
  ingredients: string | null
  body: string | null
  cover_image_url: string | null
  category_id: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
}

const clean = (v: string | null | undefined) => (v ?? '').trim() || null

// Receitas organizadas em categorias. A profissional vê também quantas
// participantes abriram cada receita (content_views, uma por pessoa).
export function useRecipes(communityId: string | null, profileId: string | null, isOwner: boolean) {
  const [categories, setCategories] = useState<RecipeCategory[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [views, setViews] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!communityId) {
      setLoading(false)
      return
    }
    const [cats, recs] = await Promise.all([
      supabase
        .from('recipe_categories')
        .select('id,name,description,cover_path,position')
        .eq('community_id', communityId)
        .order('position')
        .order('created_at'),
      supabase
        .from('community_content')
        .select('id,title,summary,ingredients,body,cover_image_url,category_id,status,created_at')
        .eq('community_id', communityId)
        .eq('type', 'recipe')
        .order('created_at', { ascending: false }),
    ])
    setCategories((cats.data as RecipeCategory[] | null) ?? [])
    setRecipes((recs.data as Recipe[] | null) ?? [])
    if (isOwner) {
      const v = await supabase.from('content_views').select('content_id').eq('community_id', communityId)
      const map: Record<string, number> = {}
      for (const row of (v.data as { content_id: string }[] | null) ?? []) {
        map[row.content_id] = (map[row.content_id] ?? 0) + 1
      }
      setViews(map)
    }
    setLoading(false)
  }, [communityId, isOwner])

  useEffect(() => {
    void load()
  }, [load])

  async function saveCategory(input: {
    id?: string
    name: string
    description: string
    cover_path: string
  }) {
    if (!communityId) return { error: 'Sem comunidade.' }
    const row = {
      name: input.name.trim(),
      description: clean(input.description),
      cover_path: clean(input.cover_path),
    }
    const { error } = input.id
      ? await supabase.from('recipe_categories').update(row).eq('id', input.id)
      : await supabase
          .from('recipe_categories')
          .insert({ ...row, community_id: communityId, position: categories.length })
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from('recipe_categories').delete().eq('id', id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  async function saveRecipe(input: {
    id?: string
    title: string
    summary: string
    ingredients: string
    body: string
    cover: string
    category_id: string | null
    status: 'draft' | 'published'
  }) {
    if (!communityId || !profileId) return { error: 'Sem comunidade.' }
    const row = {
      title: input.title.trim(),
      summary: clean(input.summary),
      ingredients: clean(input.ingredients),
      body: clean(input.body),
      cover_image_url: clean(input.cover),
      category_id: input.category_id,
      status: input.status,
      type: 'recipe',
    }
    if (input.id) {
      const { error } = await supabase.from('community_content').update(row).eq('id', input.id)
      if (!error) await load()
      return { error: error?.message ?? null, id: input.id }
    }
    // Receita nova: devolve o id para o formulário seguir aberto e a
    // profissional já poder subir as páginas em formato de revista.
    const { data, error } = await supabase
      .from('community_content')
      .insert({ ...row, community_id: communityId, created_by: profileId })
      .select('id')
      .single()
    if (!error) await load()
    return { error: error?.message ?? null, id: (data as { id: string } | null)?.id ?? null }
  }

  async function deleteRecipe(id: string) {
    const { error } = await supabase.from('community_content').delete().eq('id', id)
    if (!error) await load()
    return { error: error?.message ?? null }
  }

  // Conta a visualização uma vez por participante (a profissional não conta).
  async function recordView(contentId: string) {
    if (!communityId || !profileId || isOwner) return
    await supabase
      .from('content_views')
      .upsert(
        { content_id: contentId, profile_id: profileId, community_id: communityId },
        { onConflict: 'content_id,profile_id', ignoreDuplicates: true },
      )
  }

  return {
    categories,
    recipes,
    views,
    loading,
    saveCategory,
    deleteCategory,
    saveRecipe,
    deleteRecipe,
    recordView,
  }
}
