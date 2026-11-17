import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Seguir outra membro. A RLS só deixa seguir quem divide uma comunidade ativa
// com você (ou a dona). `followers` conta quem segue a pessoa vista.

export function useFollow(viewerId: string | null, profileId: string) {
  const [following, setFollowing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const count = await supabase
        .from('profile_follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('followed_id', profileId)
      if (active) setFollowers(count.count ?? 0)
      if (viewerId && viewerId !== profileId) {
        const mine = await supabase
          .from('profile_follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('followed_id', profileId)
          .maybeSingle()
        if (active) setFollowing(!!mine.data)
      }
    })()
    return () => {
      active = false
    }
  }, [viewerId, profileId])

  const toggle = useCallback(async () => {
    if (!viewerId || viewerId === profileId || busy) return
    setBusy(true)
    setError(null)
    const op = following
      ? supabase.from('profile_follows').delete().eq('follower_id', viewerId).eq('followed_id', profileId)
      : supabase.from('profile_follows').insert({ follower_id: viewerId, followed_id: profileId })
    const { error: opError } = await op
    setBusy(false)
    if (opError) {
      setError('Não foi possível agora. Tente de novo.')
      return
    }
    setFollowers((n) => Math.max(0, n + (following ? -1 : 1)))
    setFollowing(!following)
  }, [viewerId, profileId, following, busy])

  return { following, followers, busy, error, toggle }
}

/** Registra a visita ao perfil (uma por pessoa por dia; repetidas são ignoradas). */
export function recordProfileVisit(viewerId: string | null | undefined, profileId: string) {
  if (!viewerId || viewerId === profileId) return
  try {
    void supabase
      .from('profile_visits')
      .insert({ profile_id: profileId, visitor_id: viewerId })
      .then(
        () => undefined,
        () => undefined,
      )
  } catch {
    /* ignora */
  }
}

export interface VisitTotals {
  today: number
  week: number
  month: number
}

export function useMyVisitTotals(): VisitTotals | null {
  const [totals, setTotals] = useState<VisitTotals | null>(null)
  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('my_profile_visit_totals')
      const row = Array.isArray(data) ? data[0] : data
      if (active && row) {
        setTotals({ today: Number(row.today), week: Number(row.week), month: Number(row.month) })
      }
    })()
    return () => {
      active = false
    }
  }, [])
  return totals
}
