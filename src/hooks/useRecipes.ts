import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityContent, ContentResult, RecipeInput } from '../types/content'

// Fase 2 — RECEITAS.
//
// Receitas são uma EXTENSÃO de `community_content` (decisão arquitetural
// já tomada — sem tabela `recipes` separada). Este hook segue o mesmo
// molde de useEvents/useContent/useCircles, mas é auto-contido de
// propósito: precisa da coluna `ingredients` (migration aditiva
// `recipe_fields`) e não deve arrastar essa dependência para o
// `useContent` compartilhado (Home, painel, Master), que continua
// intocado. Toda a lógica de CRUD de `community_content` é a mesma —
// aqui só fixamos `type = 'recipe'` e limitamos a busca a esse tipo.
//
// useRecipes(null) não faz fetch.

const RECIPE_SELECT =
  `id,community_id,circle_id,created_by,type,title,summary,body,cover_image_url,` +
  `external_url,category,ingredients,status,created_at,updated_at,` +
  `author:profiles(id,full_name,avatar_url)`

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

function payload(input: RecipeInput) {
  return {
    type: 'recipe' as const,
    title: input.title.trim(),
    summary: cleanText(input.summary),
    body: cleanText(input.body),
    cover_image_url: cleanText(input.cover_image_url),
    category: cleanText(input.category),
    ingredients: cleanText(input.ingredients),
    circle_id: null,
    status: input.status ?? 'published',
  }
}

export function useRecipes(communityId: string | null) {
  const [recipes, setRecipes] = useState<CommunityContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    if (!communityId) {
      setRecipes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_content')
      .select(RECIPE_SELECT)
      .eq('community_id', communityId)
      .eq('type', 'recipe')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRecipes([])
      setLoading(false)
      return
    }

    // `likes` não é usado na experiência de receitas (card = foto + título
    // + categoria; view = foto + descrição + ingredientes). Normalizamos
    // para [] só para satisfazer o tipo CommunityContent reaproveitado.
    const rows = ((data as unknown as CommunityContent[] | null) ?? []).map((row) => ({
      ...row,
      likes: row.likes ?? [],
    }))
    setRecipes(rows)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  async function createRecipe(createdBy: string, input: RecipeInput): Promise<ContentResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase
      .from('community_content')
      .insert({ community_id: communityId, created_by: createdBy, ...payload(input) })

    if (insertError) return { error: insertError.message }

    await fetchRecipes()
    return { error: null }
  }

  async function updateRecipe(recipeId: string, input: RecipeInput): Promise<ContentResult> {
    const { error: updateError } = await supabase
      .from('community_content')
      .update(payload(input))
      .eq('id', recipeId)

    if (updateError) return { error: updateError.message }

    await fetchRecipes()
    return { error: null }
  }

  async function deleteRecipe(recipeId: string): Promise<ContentResult> {
    const { error: deleteError } = await supabase
      .from('community_content')
      .delete()
      .eq('id', recipeId)

    if (deleteError) return { error: deleteError.message }

    setRecipes((prev) => prev.filter((item) => item.id !== recipeId))
    return { error: null }
  }

  return {
    recipes,
    loading,
    error,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    refresh: fetchRecipes,
  }
}
