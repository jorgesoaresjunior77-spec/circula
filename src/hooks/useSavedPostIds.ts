import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Feed de Conversa — estado de "salvo" SÓ para posts, enxuto.
 *
 * Diferente de `useSavedItems` (que hidrata conteúdo/eventos/posts com
 * selects grandes para a tela "Salvos"), aqui buscamos apenas os ids dos
 * posts que a usuária salvou — UMA consulta — para acender o marcador
 * nos cards do feed sem custo extra de rede. O salvar/remover reusa a
 * mesma tabela `saved_items` e a mesma RLS.
 *
 * useSavedPostIds(null) não faz fetch.
 */
export function useSavedPostIds(profileId: string | null) {
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!profileId) {
      setSavedPostIds(new Set())
      return
    }
    const { data, error } = await supabase
      .from('saved_items')
      .select('item_id')
      .eq('profile_id', profileId)
      .eq('item_type', 'post')

    if (error) return
    setSavedPostIds(new Set(((data ?? []) as { item_id: string }[]).map((row) => row.item_id)))
  }, [profileId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggleSavedPost = useCallback(
    async (postId: string, currentlySaved: boolean): Promise<{ error: string | null }> => {
      if (!profileId) return { error: 'Sem sessão ativa.' }

      // otimista — reverte no erro
      setSavedPostIds((prev) => {
        const next = new Set(prev)
        if (currentlySaved) next.delete(postId)
        else next.add(postId)
        return next
      })

      if (currentlySaved) {
        const { error } = await supabase
          .from('saved_items')
          .delete()
          .eq('profile_id', profileId)
          .eq('item_type', 'post')
          .eq('item_id', postId)
        if (error) {
          await refresh()
          return { error: error.message }
        }
      } else {
        const { error } = await supabase
          .from('saved_items')
          .insert({ profile_id: profileId, item_type: 'post', item_id: postId })
        if (error && !error.message.includes('duplicate key')) {
          await refresh()
          return { error: error.message }
        }
      }

      return { error: null }
    },
    [profileId, refresh],
  )

  return { savedPostIds, toggleSavedPost, refreshSavedPostIds: refresh }
}
