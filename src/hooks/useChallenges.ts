import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  ChallengeResult,
  ChallengeWithActivities,
  JoinChallengeResult,
} from '../types/challenge'

const CHALLENGE_SELECT =
  'id,community_id,title,description,is_active,created_by,created_at,activities:challenge_activities(id,challenge_id,day_number,content)'

export function useChallenges(communityId: string | null, viewerId: string | null) {
  const [challenges, setChallenges] = useState<ChallengeWithActivities[]>([])
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({})
  const [todayCompletedCounts, setTodayCompletedCounts] = useState<Record<string, number>>({})
  const [currentDays, setCurrentDays] = useState<Record<string, number>>({})
  const [myParticipation, setMyParticipation] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCounts = useCallback(async (challengeIds: string[]) => {
    if (challengeIds.length === 0) return

    const results = await Promise.all(
      challengeIds.map((id) =>
        Promise.all([
          supabase.rpc('challenge_participant_count', { p_challenge_id: id }),
          supabase.rpc('challenge_today_completed_count', { p_challenge_id: id }),
          supabase.rpc('challenge_current_day', { p_challenge_id: id }),
        ]),
      ),
    )

    const pCounts: Record<string, number> = {}
    const tCounts: Record<string, number> = {}
    const cDays: Record<string, number> = {}

    challengeIds.forEach((id, index) => {
      const [participantResult, todayResult, dayResult] = results[index]
      if (!participantResult.error && typeof participantResult.data === 'number') {
        pCounts[id] = participantResult.data
      }
      if (!todayResult.error && typeof todayResult.data === 'number') {
        tCounts[id] = todayResult.data
      }
      if (!dayResult.error && typeof dayResult.data === 'number') {
        cDays[id] = dayResult.data
      }
    })

    setParticipantCounts((prev) => ({ ...prev, ...pCounts }))
    setTodayCompletedCounts((prev) => ({ ...prev, ...tCounts }))
    setCurrentDays((prev) => ({ ...prev, ...cDays }))
  }, [])

  const fetchChallenges = useCallback(async () => {
    if (!communityId) {
      setChallenges([])
      setParticipantCounts({})
      setTodayCompletedCounts({})
      setCurrentDays({})
      setMyParticipation(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_challenges')
      .select(CHALLENGE_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setChallenges([])
      setLoading(false)
      return
    }

    const list = ((data as unknown as ChallengeWithActivities[] | null) ?? []).map((challenge) => ({
      ...challenge,
      activities: [...challenge.activities].sort((a, b) => a.day_number - b.day_number),
    }))
    setChallenges(list)

    const ids = list.map((challenge) => challenge.id)
    await fetchCounts(ids)

    if (viewerId && ids.length > 0) {
      const { data: participantRows } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('profile_id', viewerId)
        .in('challenge_id', ids)

      setMyParticipation(new Set((participantRows ?? []).map((row) => row.challenge_id)))
    } else {
      setMyParticipation(new Set())
    }

    setLoading(false)
  }, [communityId, viewerId, fetchCounts])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  async function createChallenge(
    createdBy: string,
    title: string,
    description: string,
    activities: { day_number: number; content: string }[],
  ): Promise<ChallengeResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { data: created, error: insertError } = await supabase
      .from('community_challenges')
      .insert({
        community_id: communityId,
        title,
        description: description || null,
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    const { error: activitiesError } = await supabase.from('challenge_activities').insert(
      activities.map((activity) => ({
        challenge_id: created.id,
        day_number: activity.day_number,
        content: activity.content,
      })),
    )

    await fetchChallenges()

    if (activitiesError) {
      return {
        error: `Desafio criado, mas houve um problema ao salvar as atividades: ${activitiesError.message}`,
      }
    }

    return { error: null }
  }

  async function updateChallenge(
    challengeId: string,
    input: { title: string; description: string },
  ): Promise<ChallengeResult> {
    const { error: updateError } = await supabase
      .from('community_challenges')
      .update({ title: input.title, description: input.description || null })
      .eq('id', challengeId)

    if (updateError) return { error: updateError.message }

    setChallenges((prev) =>
      prev.map((challenge) =>
        challenge.id === challengeId
          ? { ...challenge, title: input.title, description: input.description || null }
          : challenge,
      ),
    )
    return { error: null }
  }

  async function toggleActive(challengeId: string, isActive: boolean): Promise<ChallengeResult> {
    const { error: updateError } = await supabase
      .from('community_challenges')
      .update({ is_active: isActive })
      .eq('id', challengeId)

    if (updateError) return { error: updateError.message }

    setChallenges((prev) =>
      prev.map((challenge) =>
        challenge.id === challengeId ? { ...challenge, is_active: isActive } : challenge,
      ),
    )
    return { error: null }
  }

  async function deleteChallenge(challengeId: string): Promise<ChallengeResult> {
    const { error: deleteError } = await supabase
      .from('community_challenges')
      .delete()
      .eq('id', challengeId)

    if (deleteError) return { error: deleteError.message }

    setChallenges((prev) => prev.filter((challenge) => challenge.id !== challengeId))
    return { error: null }
  }

  async function joinChallenge(challengeId: string, profileId: string): Promise<JoinChallengeResult> {
    const { error: insertError } = await supabase.from('challenge_participants').insert({
      challenge_id: challengeId,
      profile_id: profileId,
    })

    if (insertError) {
      if (insertError.message.includes('duplicate key')) {
        setMyParticipation((prev) => new Set(prev).add(challengeId))
        return { error: null }
      }
      return { error: insertError.message }
    }

    setMyParticipation((prev) => new Set(prev).add(challengeId))
    await fetchCounts([challengeId])
    return { error: null }
  }

  async function leaveChallenge(challengeId: string, profileId: string): Promise<JoinChallengeResult> {
    const { error: deleteError } = await supabase
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', challengeId)
      .eq('profile_id', profileId)

    if (deleteError) return { error: deleteError.message }

    setMyParticipation((prev) => {
      const next = new Set(prev)
      next.delete(challengeId)
      return next
    })
    await fetchCounts([challengeId])
    return { error: null }
  }

  async function refreshCounts(challengeId: string) {
    await fetchCounts([challengeId])
  }

  return {
    challenges,
    participantCounts,
    todayCompletedCounts,
    currentDays,
    myParticipation,
    loading,
    error,
    createChallenge,
    updateChallenge,
    toggleActive,
    deleteChallenge,
    joinChallenge,
    leaveChallenge,
    refreshCounts,
    refresh: fetchChallenges,
  }
}
