import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAchievements } from './useAchievements'

// Fase 10 — resumo leve para o trilho direito da Home (>= 1280px).
// Reaproveita useAchievements (saldo de pontos + nº de conquistas) e
// acrescenta só o PRÓXIMO evento. Sem migration, sem RPC, read-only.
// useRailSummary(null) não busca.

interface NextEvent {
  id: string
  title: string
  starts_at: string
}

export function useRailSummary(communityId: string | null, profileId: string | null) {
  const { unlockedCount, pointsBalance, loading: achLoading } = useAchievements(
    communityId,
    profileId,
  )
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNextEvent = useCallback(async () => {
    if (!communityId) {
      setNextEvent(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const { data } = await supabase
      .from('community_events')
      .select('id,title,starts_at')
      .eq('community_id', communityId)
      .neq('status', 'draft')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    setNextEvent((data as NextEvent | null) ?? null)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchNextEvent()
  }, [fetchNextEvent])

  return {
    pointsBalance,
    achievementsCount: unlockedCount,
    nextEvent,
    loading: loading || achLoading,
  }
}
