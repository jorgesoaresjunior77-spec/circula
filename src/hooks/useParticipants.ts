import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ParticipantOverview } from '../types/panel'

// Fase 8 — visão consolidada das participantes da PRÓPRIA comunidade.
//
// Fonte única: RPC `community_participants_overview` (SECURITY DEFINER,
// guard owns_community/is_master). Traz pontos, desafios e atividade
// recente. NÃO traz humor individual — a RPC nem toca daily_mood_entries.
//
// useParticipants(null) não busca.

export function useParticipants(communityId: string | null) {
  const [participants, setParticipants] = useState<ParticipantOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchParticipants = useCallback(async () => {
    if (!communityId) {
      setParticipants([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase.rpc('community_participants_overview', {
      p_community_id: communityId,
    })

    if (fetchError) {
      setError(fetchError.message)
      setParticipants([])
      setLoading(false)
      return
    }

    setParticipants((data as ParticipantOverview[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  return { participants, loading, error, refresh: fetchParticipants }
}
