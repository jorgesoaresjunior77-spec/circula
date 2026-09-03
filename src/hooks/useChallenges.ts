import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays } from '../lib/challengePeriod'
import type {
  ChallengeActivityDraft,
  ChallengeComment,
  ChallengeCommentResult,
  ChallengeDetailsInput,
  ChallengeResult,
  ChallengeWithActivities,
  JoinChallengeResult,
} from '../types/challenge'

const CHALLENGE_SELECT =
  'id,community_id,title,description,cover_image_url,starts_on,ends_on,completion_points,per_day_points,is_active,created_by,created_at,activities:challenge_activities(id,challenge_id,day_number,content)'

const CHALLENGE_COMMENT_SELECT =
  'id,challenge_id,author_id,content,created_at,author:profiles(id,full_name,avatar_url)'

/** Fim do periodo = inicio + (numero de dias - 1). Sem dias => 1 dia. */
function computeEndsOn(startsOn: string, dayCount: number): string {
  return addDays(startsOn, Math.max(dayCount, 1) - 1)
}

export function useChallenges(communityId: string | null, viewerId: string | null) {
  const [challenges, setChallenges] = useState<ChallengeWithActivities[]>([])
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({})
  const [todayCompletedCounts, setTodayCompletedCounts] = useState<Record<string, number>>({})
  const [currentDays, setCurrentDays] = useState<Record<string, number>>({})
  const [myParticipation, setMyParticipation] = useState<Set<string>>(new Set())
  const [myCompletions, setMyCompletions] = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [commentsByChallenge, setCommentsByChallenge] = useState<Record<string, ChallengeComment[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommentCounts = useCallback(async (challengeIds: string[]) => {
    if (challengeIds.length === 0) return

    const { data } = await supabase
      .from('challenge_comments')
      .select('challenge_id')
      .in('challenge_id', challengeIds)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.challenge_id] = (counts[row.challenge_id] ?? 0) + 1
    }
    setCommentCounts((prev) => ({ ...prev, ...counts }))
  }, [])

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
      setMyCompletions(new Set())
      setCommentCounts({})
      setCommentsByChallenge({})
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
    await Promise.all([fetchCounts(ids), fetchCommentCounts(ids)])

    if (viewerId && ids.length > 0) {
      const [{ data: participantRows }, { data: completionRows }] = await Promise.all([
        supabase
          .from('challenge_participants')
          .select('challenge_id')
          .eq('profile_id', viewerId)
          .in('challenge_id', ids),
        supabase
          .from('challenge_completions')
          .select('challenge_id')
          .eq('profile_id', viewerId)
          .in('challenge_id', ids),
      ])

      setMyParticipation(new Set((participantRows ?? []).map((row) => row.challenge_id)))
      setMyCompletions(new Set((completionRows ?? []).map((row) => row.challenge_id)))
    } else {
      setMyParticipation(new Set())
      setMyCompletions(new Set())
    }

    setLoading(false)
  }, [communityId, viewerId, fetchCounts, fetchCommentCounts])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  async function createChallenge(
    createdBy: string,
    details: ChallengeDetailsInput,
    activities: { day_number: number; content: string }[],
  ): Promise<ChallengeResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { data: created, error: insertError } = await supabase
      .from('community_challenges')
      .insert({
        community_id: communityId,
        title: details.title,
        description: details.description || null,
        cover_image_url: details.coverImageUrl || null,
        starts_on: details.startsOn,
        ends_on: computeEndsOn(details.startsOn, activities.length),
        completion_points: details.completionPoints,
        per_day_points: details.perDayPoints,
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
    details: ChallengeDetailsInput,
    activities: ChallengeActivityDraft[],
  ): Promise<ChallengeResult> {
    const target = challenges.find((challenge) => challenge.id === challengeId)
    const existingDays = target ? target.activities.map((activity) => activity.day_number) : []
    const newCount = activities.length
    const removedDays = existingDays.filter((day) => day > newCount)

    // Nao apagar um dia que ja tem progresso de participante (o cascade
    // apagaria as linhas de challenge_progress). A Nutri deve desativar o
    // desafio nesse caso, nao encurta-lo.
    if (removedDays.length > 0) {
      const { data: progressRows } = await supabase
        .from('challenge_progress')
        .select('day_number')
        .eq('challenge_id', challengeId)
        .in('day_number', removedDays)
        .limit(1)

      if (progressRows && progressRows.length > 0) {
        return {
          error:
            'Não dá para remover dias que já têm progresso de participantes. Desative o desafio em vez de encurtá-lo.',
        }
      }
    }

    const { error: updateError } = await supabase
      .from('community_challenges')
      .update({
        title: details.title,
        description: details.description || null,
        cover_image_url: details.coverImageUrl || null,
        starts_on: details.startsOn,
        ends_on: computeEndsOn(details.startsOn, newCount),
        completion_points: details.completionPoints,
        per_day_points: details.perDayPoints,
      })
      .eq('id', challengeId)

    if (updateError) return { error: updateError.message }

    // Sincroniza as atividades: atualiza o texto dos dias existentes,
    // insere os dias novos ao final, remove os dias excedentes (ja
    // checado acima que nao tem progresso).
    for (const draft of activities) {
      const existing = target?.activities.find((activity) => activity.day_number === draft.day_number)
      if (existing) {
        if (existing.content !== draft.content) {
          const { error: contentError } = await supabase
            .from('challenge_activities')
            .update({ content: draft.content })
            .eq('challenge_id', challengeId)
            .eq('day_number', draft.day_number)
          if (contentError) return { error: contentError.message }
        }
      } else {
        const { error: insertDayError } = await supabase.from('challenge_activities').insert({
          challenge_id: challengeId,
          day_number: draft.day_number,
          content: draft.content,
        })
        if (insertDayError) return { error: insertDayError.message }
      }
    }

    if (removedDays.length > 0) {
      const { error: deleteDaysError } = await supabase
        .from('challenge_activities')
        .delete()
        .eq('challenge_id', challengeId)
        .in('day_number', removedDays)
      if (deleteDaysError) return { error: deleteDaysError.message }
    }

    await fetchChallenges()
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

  /** Recarrega apenas o estado de conclusao da viewer para um desafio. */
  async function refreshCompletions(challengeId: string) {
    if (!viewerId) return
    const { data } = await supabase
      .from('challenge_completions')
      .select('challenge_id')
      .eq('profile_id', viewerId)
      .eq('challenge_id', challengeId)

    setMyCompletions((prev) => {
      const next = new Set(prev)
      if (data && data.length > 0) next.add(challengeId)
      else next.delete(challengeId)
      return next
    })
  }

  async function fetchComments(challengeId: string): Promise<ChallengeCommentResult> {
    const { data, error: fetchError } = await supabase
      .from('challenge_comments')
      .select(CHALLENGE_COMMENT_SELECT)
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      return { error: fetchError.message }
    }

    setCommentsByChallenge((prev) => ({
      ...prev,
      [challengeId]: (data as unknown as ChallengeComment[]) ?? [],
    }))
    return { error: null }
  }

  async function addComment(
    challengeId: string,
    authorId: string,
    content: string,
  ): Promise<ChallengeCommentResult> {
    const { error: insertError } = await supabase.from('challenge_comments').insert({
      challenge_id: challengeId,
      author_id: authorId,
      content,
    })

    if (insertError) {
      return { error: insertError.message }
    }

    setCommentCounts((prev) => ({ ...prev, [challengeId]: (prev[challengeId] ?? 0) + 1 }))
    await fetchComments(challengeId)
    return { error: null }
  }

  return {
    challenges,
    participantCounts,
    todayCompletedCounts,
    currentDays,
    myParticipation,
    myCompletions,
    commentCounts,
    commentsByChallenge,
    loading,
    error,
    createChallenge,
    updateChallenge,
    toggleActive,
    deleteChallenge,
    joinChallenge,
    leaveChallenge,
    refreshCounts,
    refreshCompletions,
    fetchComments,
    addComment,
    refresh: fetchChallenges,
  }
}
