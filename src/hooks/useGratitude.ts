import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Prayer } from '../lib/gratitude'

// Diário da Gratidão: orações (da nutricionista), registros e pedidos (privados).

export interface GratitudeEntry {
  id: string
  day: string
  items: string[]
}
export interface GratitudeRequest {
  id: string
  body: string
  status: 'aberto' | 'atendido'
  answered_at: string | null
  created_at: string
}

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente de novo.'

export function useGratitude(communityId: string | null, profileId: string) {
  const [prayers, setPrayers] = useState<Prayer[]>([])
  const [entries, setEntries] = useState<GratitudeEntry[]>([])
  const [requests, setRequests] = useState<GratitudeRequest[]>([])
  const [amenDays, setAmenDays] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const reload = useCallback(() => setToken((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [p, e, r, a] = await Promise.all([
        communityId
          ? supabase.from('gratitude_prayers').select('id,title,body,status,position').eq('community_id', communityId).order('position')
          : Promise.resolve({ data: [] as Prayer[] }),
        supabase.from('gratitude_entries').select('id,day,items').eq('profile_id', profileId).order('day', { ascending: false }).limit(400),
        supabase.from('gratitude_requests').select('id,body,status,answered_at,created_at').eq('profile_id', profileId).order('created_at', { ascending: false }),
        supabase.from('gratitude_amen').select('day').eq('profile_id', profileId).order('day', { ascending: false }).limit(400),
      ])
      if (cancelled) return
      setPrayers((p.data ?? []) as Prayer[])
      setEntries((e.data ?? []) as GratitudeEntry[])
      setRequests((r.data ?? []) as GratitudeRequest[])
      setAmenDays(((a.data ?? []) as { day: string }[]).map((x) => x.day))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, token])

  const run = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>): Promise<Result> => {
      const { error } = await fn()
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const sayAmen = (day: string) => run(() => supabase.from('gratitude_amen').upsert({ profile_id: profileId, day }, { onConflict: 'profile_id,day' }))
  const saveToday = (day: string, items: string[]) =>
    run(() => supabase.from('gratitude_entries').upsert({ profile_id: profileId, day, items }, { onConflict: 'profile_id,day' }))
  const addRequest = (body: string) => run(() => supabase.from('gratitude_requests').insert({ body }))
  const setAnswered = (id: string, answered: boolean) =>
    run(() => supabase.from('gratitude_requests').update({ status: answered ? 'atendido' : 'aberto', answered_at: answered ? new Date().toISOString() : null }).eq('id', id))
  const removeRequest = (id: string) => run(() => supabase.from('gratitude_requests').delete().eq('id', id))

  // administração das orações (dona da comunidade)
  const savePrayer = (id: string | null, v: { title: string | null; body: string; status: 'draft' | 'published' }) =>
    run(() => (id ? supabase.from('gratitude_prayers').update(v).eq('id', id) : supabase.from('gratitude_prayers').insert({ ...v, community_id: communityId, position: prayers.length + 1 })))
  const removePrayer = (id: string) => run(() => supabase.from('gratitude_prayers').delete().eq('id', id))

  return { prayers, entries, requests, amenDays, loading, sayAmen, saveToday, addRequest, setAnswered, removeRequest, savePrayer, removePrayer }
}
