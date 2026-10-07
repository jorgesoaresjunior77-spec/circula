import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Fase 10 — resumo leve para a Home: só o PRÓXIMO evento. Sem migration,
// sem RPC, read-only. useRailSummary(null) não busca.
//
// Saldo de pontos e nº de conquistas saíram daqui junto com a remoção
// das funcionalidades de Pontos/Conquistas (Etapa A) — o hook mantém o
// nome para minimizar o diff nos chamadores (Dashboard.tsx/HomeToday.tsx),
// mas agora só cobre o próximo evento, que não pertence a nenhuma das
// três funcionalidades removidas.

interface NextEvent {
  id: string
  title: string
  starts_at: string
}

export function useRailSummary(communityId: string | null, profileId: string | null) {
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNextEvent = useCallback(async () => {
    if (!communityId || !profileId) {
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
  }, [communityId, profileId])

  useEffect(() => {
    fetchNextEvent()
  }, [fetchNextEvent])

  return {
    nextEvent,
    loading,
  }
}
