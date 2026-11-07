import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Lista de conteúdo da comunidade (dicas de leitura, sessões de bem-estar)
// com criar/editar/excluir para quem gerencia. A RLS decide o que cada
// pessoa vê (membro: só publicado) e quem escreve (só a dona).

export type ManagedTable = 'reading_tips' | 'wellness_sessions' | 'daily_inspirations' | 'community_partners'

export function useManagedContent<T extends { id: string }>(
  table: ManagedTable,
  communityId: string | null,
  orderBy: string,
) {
  const [loaded, setLoaded] = useState<{ communityId: string; items: T[]; error: string | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('community_id', communityId)
        .order(orderBy, { ascending: true })
      if (cancelled) return
      setLoaded({
        communityId,
        items: (data ?? []) as T[],
        error: error ? 'Não foi possível carregar este conteúdo agora.' : null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [table, communityId, orderBy, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const save = useCallback(
    async (id: string | null, values: Record<string, unknown>): Promise<{ error: string | null }> => {
      if (!communityId) return { error: 'Escolha uma comunidade.' }
      const { error } = id
        ? await supabase.from(table).update(values).eq('id', id)
        : await supabase.from(table).insert({ ...values, community_id: communityId })
      if (error) return { error: 'Não foi possível salvar agora. Tente de novo.' }
      reload()
      return { error: null }
    },
    [table, communityId, reload],
  )

  const remove = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) return { error: 'Não foi possível excluir agora. Tente de novo.' }
      reload()
      return { error: null }
    },
    [table, reload],
  )

  const current = loaded && loaded.communityId === communityId ? loaded : null
  return {
    items: current?.items ?? [],
    loading: !!communityId && current === null,
    error: current?.error ?? null,
    save,
    remove,
  }
}
