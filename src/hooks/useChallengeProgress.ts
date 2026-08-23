import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ToggleProgressResult } from '../types/challenge'

export function useChallengeProgress(challengeId: string | null, profileId: string | null) {
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!challengeId || !profileId) {
      setCompletedDays(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('challenge_progress')
      .select('day_number')
      .eq('challenge_id', challengeId)
      .eq('profile_id', profileId)

    if (fetchError) {
      setError(fetchError.message)
      setCompletedDays(new Set())
      setLoading(false)
      return
    }

    setCompletedDays(new Set((data ?? []).map((row) => row.day_number)))
    setLoading(false)
  }, [challengeId, profileId])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  async function toggleDay(dayNumber: number, currentDay: number): Promise<ToggleProgressResult> {
    if (!challengeId || !profileId) return { error: 'Sem sessão ativa.' }
    if (dayNumber > currentDay) return { error: 'Este dia ainda não foi liberado.' }

    const alreadyCompleted = completedDays.has(dayNumber)

    if (alreadyCompleted) {
      const { error: deleteError } = await supabase
        .from('challenge_progress')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('profile_id', profileId)
        .eq('day_number', dayNumber)

      if (deleteError) return { error: deleteError.message }

      setCompletedDays((prev) => {
        const next = new Set(prev)
        next.delete(dayNumber)
        return next
      })
      return { error: null }
    }

    const { error: insertError } = await supabase.from('challenge_progress').insert({
      challenge_id: challengeId,
      profile_id: profileId,
      day_number: dayNumber,
    })

    if (insertError) return { error: insertError.message }

    setCompletedDays((prev) => new Set(prev).add(dayNumber))
    return { error: null }
  }

  return { completedDays, loading, error, toggleDay, refresh: fetchProgress }
}
