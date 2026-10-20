import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gardenErrorMessage } from '../types/garden'
import type {
  GardenChallenge,
  GardenChallengeDay,
  GardenCompletion,
  GardenEnrollment,
  GardenResult,
} from '../types/garden'

const CHALLENGE_SELECT =
  'id,community_id,created_by,title,description,status,duration_days,starts_on,' +
  'enrollment_opens_at,enrollment_closes_at,allow_late_enrollment,cover_image_url,' +
  'created_at,updated_at,archived_at'

const DAY_SELECT =
  'id,challenge_id,day_number,activity_date,title,instructions,icon,encouragement_message,created_at,updated_at'

/**
 * Member · Meu Jardim — desafios disponíveis, inscrição, dias
 * liberados/futuros e conclusão. A RLS de `garden_challenges` já
 * restringe o SELECT a desafios publicados da própria comunidade (+ os
 * que a pessoa administra), então esta busca não precisa (e não deve)
 * repetir esse filtro no cliente.
 *
 * useGardenMember(null, null) não faz fetch.
 */
export function useGardenMember(communityId: string | null, profileId: string | null) {
  const [challenges, setChallenges] = useState<GardenChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [myEnrollments, setMyEnrollments] = useState<GardenEnrollment[]>([])
  const [myCompletions, setMyCompletions] = useState<GardenCompletion[]>([])
  const [mySharedCompletionIds, setMySharedCompletionIds] = useState<Set<string>>(new Set())

  const [daysByChallenge, setDaysByChallenge] = useState<Record<string, GardenChallengeDay[]>>({})
  const [daysLoading, setDaysLoading] = useState<Record<string, boolean>>({})

  const fetchAll = useCallback(async () => {
    if (!communityId || !profileId) {
      setChallenges([])
      setMyEnrollments([])
      setMyCompletions([])
      setMySharedCompletionIds(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('garden_challenges')
      .select(CHALLENGE_SELECT)
      .eq('community_id', communityId)
      .order('starts_on', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setChallenges([])
      setLoading(false)
      return
    }

    const list = (data as unknown as GardenChallenge[] | null) ?? []
    setChallenges(list)

    if (list.length > 0) {
      const challengeIds = list.map((c) => c.id)

      const [enrollmentsResult, completionsResult] = await Promise.all([
        supabase
          .from('garden_enrollments')
          .select('id,challenge_id,profile_id,enrolled_at')
          .eq('profile_id', profileId)
          .in('challenge_id', challengeIds),
        supabase
          .from('garden_completions')
          .select('id,challenge_id,challenge_day_id,enrollment_id,profile_id,completed_at')
          .eq('profile_id', profileId)
          .in('challenge_id', challengeIds),
      ])

      const enrollments = (enrollmentsResult.data as unknown as GardenEnrollment[] | null) ?? []
      const completions = (completionsResult.data as unknown as GardenCompletion[] | null) ?? []
      setMyEnrollments(enrollments)
      setMyCompletions(completions)

      if (completions.length > 0) {
        const { data: shareRows } = await supabase
          .from('garden_shares')
          .select('completion_id')
          .eq('profile_id', profileId)
          .in(
            'completion_id',
            completions.map((c) => c.id),
          )
        setMySharedCompletionIds(
          new Set(((shareRows as { completion_id: string }[] | null) ?? []).map((r) => r.completion_id)),
        )
      } else {
        setMySharedCompletionIds(new Set())
      }
    } else {
      setMyEnrollments([])
      setMyCompletions([])
      setMySharedCompletionIds(new Set())
    }

    setLoading(false)
  }, [communityId, profileId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function enroll(challengeId: string): Promise<GardenResult> {
    if (!profileId) return { error: 'Sem sessão ativa.' }

    const { error: insertError } = await supabase
      .from('garden_enrollments')
      .insert({ challenge_id: challengeId, profile_id: profileId })

    // Mesma tolerância de useEvents.rsvp: já inscrita não é erro.
    if (insertError && !insertError.message.includes('duplicate key')) {
      return { error: gardenErrorMessage(insertError.message) }
    }

    await fetchAll()
    return { error: null }
  }

  const fetchDays = useCallback(async (challengeId: string) => {
    setDaysLoading((prev) => ({ ...prev, [challengeId]: true }))

    const { data, error: fetchError } = await supabase
      .from('garden_challenge_days')
      .select(DAY_SELECT)
      .eq('challenge_id', challengeId)
      .order('day_number', { ascending: true })

    setDaysLoading((prev) => ({ ...prev, [challengeId]: false }))

    if (fetchError) return { error: fetchError.message }

    setDaysByChallenge((prev) => ({
      ...prev,
      [challengeId]: (data as unknown as GardenChallengeDay[] | null) ?? [],
    }))
    return { error: null }
  }, [])

  async function completeDay(challengeDayId: string): Promise<GardenResult & { id?: string }> {
    const { data, error: rpcError } = await supabase.rpc('garden_complete_day', {
      p_challenge_day_id: challengeDayId,
    })

    if (rpcError) return { error: gardenErrorMessage(rpcError.message) }

    await fetchAll()
    return { error: null, id: (data as GardenCompletion | null)?.id }
  }

  async function shareCompletion(completionId: string, content: string): Promise<GardenResult> {
    const { error: rpcError } = await supabase.rpc('garden_share_completion', {
      p_completion_id: completionId,
      p_content: content,
    })

    if (rpcError) return { error: gardenErrorMessage(rpcError.message) }

    setMySharedCompletionIds((prev) => new Set(prev).add(completionId))
    return { error: null }
  }

  return {
    challenges,
    loading,
    error,
    myEnrollments,
    myCompletions,
    mySharedCompletionIds,
    enroll,
    daysByChallenge,
    daysLoading,
    fetchDays,
    completeDay,
    shareCompletion,
    refresh: fetchAll,
  }
}
