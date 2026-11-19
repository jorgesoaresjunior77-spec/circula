import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MenuRecipe, RecipeMenuMeta } from '../lib/menuBuilder'

// Biblioteca para o montador de cardápios: as MESMAS receitas publicadas de
// sempre (community_content type='recipe') + a ficha do cardápio de cada uma
// (recipe_menu_meta). Receita sem ficha vem com meta = null e o motor a ignora.
export function useMenuLibrary(communityId: string | null) {
  const [recipes, setRecipes] = useState<MenuRecipe[]>([])
  const [loading, setLoading] = useState(!!communityId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!communityId) {
      setLoading(false)
      return
    }
    let active = true
    void (async () => {
      const [recs, metas] = await Promise.all([
        supabase
          .from('community_content')
          .select('id,title,summary,ingredients,body,cover_image_url,status')
          .eq('community_id', communityId)
          .eq('type', 'recipe')
          .eq('status', 'published'),
        supabase
          .from('recipe_menu_meta')
          .select('content_id,course,cuisines,diets,allergens,allergens_verified,prep_minutes,difficulty,servings,est_cost_cents')
          .eq('community_id', communityId),
      ])
      if (!active) return
      if (recs.error || metas.error) {
        setError('Não foi possível carregar as receitas agora. Tente novamente.')
        setLoading(false)
        return
      }
      const byId = new Map<string, RecipeMenuMeta>()
      for (const m of (metas.data as (RecipeMenuMeta & { content_id: string })[] | null) ?? []) byId.set(m.content_id, m)
      setRecipes(
        ((recs.data as Omit<MenuRecipe, 'meta'>[] | null) ?? []).map((r) => ({ ...r, meta: byId.get(r.id) ?? null })),
      )
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [communityId])

  return { recipes, loading, error }
}
