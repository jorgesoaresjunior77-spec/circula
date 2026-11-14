import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Páginas (imagens) de uma prática de Respiração e Meditação — mesmo esquema
// das páginas de e-book. A dona vê e escreve; a membro lê as de prática
// publicada (RLS). Sem limite de páginas.

export interface SessionPage {
  id: string
  session_id: string
  position: number
  image_path: string
}

type Result = { error: string | null }

export function useSessionPages(sessionId: string | null, communityId: string | null) {
  const [loaded, setLoaded] = useState<{ sessionId: string; pages: SessionPage[] } | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('wellness_session_pages')
        .select('id,session_id,position,image_path')
        .eq('session_id', sessionId)
        .order('position', { ascending: true })
      if (!cancelled) setLoaded({ sessionId, pages: (data as SessionPage[] | null) ?? [] })
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])
  const ready = !!loaded && loaded.sessionId === sessionId
  const pages = ready ? loaded.pages : []

  const addPage = useCallback(
    async (imagePath: string): Promise<Result> => {
      if (!sessionId || !communityId) return { error: 'Salve a prática antes de adicionar páginas.' }
      const next = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1
      const { error } = await supabase.from('wellness_session_pages').insert({
        session_id: sessionId,
        community_id: communityId,
        position: next,
        image_path: imagePath,
      })
      if (error) return { error: 'Não foi possível salvar a página agora.' }
      reload()
      return { error: null }
    },
    [sessionId, communityId, pages, reload],
  )

  const removePage = useCallback(
    async (pageId: string): Promise<Result> => {
      const { error } = await supabase.from('wellness_session_pages').delete().eq('id', pageId)
      if (error) return { error: 'Não foi possível remover agora.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { pages, ready, addPage, removePage }
}

/** Todas as páginas das práticas da comunidade, agrupadas por prática (uma consulta). */
export function useCommunitySessionPages(communityId: string | null, reloadKey = 0) {
  const [bySession, setBySession] = useState<Record<string, SessionPage[]>>({})

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('wellness_session_pages')
        .select('id,session_id,position,image_path')
        .eq('community_id', communityId)
        .order('position', { ascending: true })
      if (cancelled) return
      const map: Record<string, SessionPage[]> = {}
      for (const row of (data as SessionPage[] | null) ?? []) {
        ;(map[row.session_id] ??= []).push(row)
      }
      setBySession(map)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, reloadKey])

  return bySession
}
