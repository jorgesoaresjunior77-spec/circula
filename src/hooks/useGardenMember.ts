import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** Erro da última busca de dias por desafio — distingue "falhou ao carregar" de "carregou e não há dias". `null` = sem erro (nunca buscou, ainda carregando, ou carregou com sucesso). Mesmo padrão de useGardenChallenges.ts. */
  const [daysError, setDaysError] = useState<Record<string, string | null>>({})
  /** Contador de sequência por desafio — ao terminar, uma chamada só aplica seu resultado se ainda for a mais recente para aquele desafio (mesmo padrão de useGardenChallenges.ts). */
  const daysRequestSeq = useRef<Record<string, number>>({})

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
    // Mesma lógica de useGardenChallenges.fetchDays: sequência própria por
    // desafio, para que uma resposta antiga (sucesso, erro ou exceção) nunca
    // sobrescreva o resultado de uma chamada mais recente para o mesmo
    // challengeId, mesmo que termine depois dela.
    const seq = (daysRequestSeq.current[challengeId] ?? 0) + 1
    daysRequestSeq.current[challengeId] = seq
    const isLatest = () => daysRequestSeq.current[challengeId] === seq

    setDaysLoading((prev) => ({ ...prev, [challengeId]: true }))
    setDaysError((prev) => ({ ...prev, [challengeId]: null }))

    try {
      const { data, error: fetchError } = await supabase
        .from('garden_challenge_days')
        .select(DAY_SELECT)
        .eq('challenge_id', challengeId)
        .order('day_number', { ascending: true })

      if (!isLatest()) return { error: null }

      if (fetchError) {
        // Não mexe em daysByChallenge — o que já estava carregado permanece,
        // mas quem consome precisa checar daysError antes de interpretar
        // `days.length === 0` como "não há dias".
        setDaysError((prev) => ({ ...prev, [challengeId]: fetchError.message }))
        return { error: fetchError.message }
      }

      setDaysByChallenge((prev) => ({
        ...prev,
        [challengeId]: (data as unknown as GardenChallengeDay[] | null) ?? [],
      }))
      return { error: null }
    } catch (err) {
      // Exceção de verdade (rejeição de rede, etc.), não um {error} do
      // PostgREST — sem isto, daysLoading ficaria travado em `true` para
      // sempre (o finally abaixo é quem garante o desligamento).
      if (!isLatest()) return { error: null }
      const message = err instanceof Error ? err.message : 'Não foi possível carregar os dias agora.'
      setDaysError((prev) => ({ ...prev, [challengeId]: message }))
      return { error: message }
    } finally {
      // Só a chamada mais recente desliga o carregamento.
      if (isLatest()) {
        setDaysLoading((prev) => ({ ...prev, [challengeId]: false }))
      }
    }
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
    daysError,
    fetchDays,
    completeDay,
    shareCompletion,
    refresh: fetchAll,
  }
}
