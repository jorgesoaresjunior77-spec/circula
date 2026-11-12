import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Páginas (imagens) de uma receita em formato de revista. A RLS decide o
// que cada papel enxerga (membro: só de receita publicada).

export const RECIPE_PAGES_MAX = 5

export interface RecipePage {
  id: string
  content_id: string
  position: number
  image_path: string
}

type Result = { error: string | null }

export function useRecipePages(contentId: string | null, communityId: string | null) {
  const [loaded, setLoaded] = useState<{ contentId: string; pages: RecipePage[] } | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!contentId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('recipe_pages')
        .select('id,content_id,position,image_path')
        .eq('content_id', contentId)
        .order('position', { ascending: true })
      if (!cancelled) setLoaded({ contentId, pages: (data as RecipePage[] | null) ?? [] })
    })()
    return () => {
      cancelled = true
    }
  }, [contentId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])
  const pages = loaded && loaded.contentId === contentId ? loaded.pages : []

  const addPage = useCallback(
    async (imagePath: string): Promise<Result> => {
      if (!contentId || !communityId) return { error: 'Salve a receita antes de adicionar páginas.' }
      if (pages.length >= RECIPE_PAGES_MAX) return { error: `No máximo ${RECIPE_PAGES_MAX} páginas.` }
      const next = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1
      const { error } = await supabase.from('recipe_pages').insert({
        content_id: contentId,
        community_id: communityId,
        position: next,
        image_path: imagePath,
      })
      if (error) return { error: 'Não foi possível salvar a página agora.' }
      reload()
      return { error: null }
    },
    [contentId, communityId, pages, reload],
  )

  const removePage = useCallback(
    async (pageId: string): Promise<Result> => {
      const { error } = await supabase.from('recipe_pages').delete().eq('id', pageId)
      if (error) return { error: 'Não foi possível remover agora.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { pages, addPage, removePage }
}
