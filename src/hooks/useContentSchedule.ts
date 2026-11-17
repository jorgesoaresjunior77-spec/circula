import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ContentType, ScheduleItem } from '../lib/contentSchedule'

type Result = { error: string | null }

export function useContentSchedule(communityId: string | null) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('content_schedule')
        .select('id,community_id,content_type,title,notes,scheduled_on,done')
        .eq('community_id', communityId)
        .order('scheduled_on', { ascending: true })
        .limit(500)
      if (cancelled) return
      setItems((data as ScheduleItem[] | null) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const add = useCallback(
    async (input: { content_type: ContentType; title: string; notes: string; scheduled_on: string }): Promise<Result> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { error } = await supabase.from('content_schedule').insert({
        community_id: communityId,
        content_type: input.content_type,
        title: input.title.trim(),
        notes: input.notes.trim() || null,
        scheduled_on: input.scheduled_on,
      })
      if (error) return { error: 'Não foi possível salvar agora. Tente novamente.' }
      reload()
      return { error: null }
    },
    [communityId, reload],
  )

  const setDone = useCallback(
    async (id: string, done: boolean): Promise<Result> => {
      const { error } = await supabase.from('content_schedule').update({ done }).eq('id', id)
      if (error) return { error: 'Não foi possível atualizar agora.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  const remove = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('content_schedule').delete().eq('id', id)
      if (error) return { error: 'Não foi possível excluir agora.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { items, loading, add, setDone, remove }
}
