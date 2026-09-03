import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ToggleProgressResult } from '../types/challenge'

/**
 * Progresso da propria participante em um desafio: dias concluidos e
 * estado de conclusao do desafio inteiro.
 *
 * A conclusao (tabela `challenge_completions`) e reconciliada
 * automaticamente com o progresso real: quando a participante fecha o
 * ultimo dia, a linha de conclusao e inserida; se ela desmarca um dia
 * depois, a linha e removida. Isso e SO ESTRUTURA — nenhum ponto e
 * calculado ou concedido aqui (Fase 7).
 */
export function useChallengeProgress(
  challengeId: string | null,
  profileId: string | null,
  duration: number,
  completedInitially: boolean,
) {
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set())
  const [completed, setCompleted] = useState(completedInitially)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCompleted(completedInitially)
  }, [completedInitially])

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

  /**
   * Alinha `challenge_completions` ao numero de dias concluidos.
   * Retorna `true`/`false` se o estado de conclusao mudou, `null` se nao.
   */
  const reconcileCompletion = useCallback(
    async (completedCount: number): Promise<boolean | null> => {
      if (!challengeId || !profileId || duration <= 0) return null
      const shouldBeComplete = completedCount >= duration

      if (shouldBeComplete && !completed) {
        const { error: insertError } = await supabase
          .from('challenge_completions')
          .insert({ challenge_id: challengeId, profile_id: profileId })
        // UNIQUE(challenge_id, profile_id) protege contra duplicacao: se
        // ja existir, tratamos como sucesso.
        if (insertError && !insertError.message.includes('duplicate key')) return null
        setCompleted(true)
        return true
      }

      if (!shouldBeComplete && completed) {
        const { error: deleteError } = await supabase
          .from('challenge_completions')
          .delete()
          .eq('challenge_id', challengeId)
          .eq('profile_id', profileId)
        if (deleteError) return null
        setCompleted(false)
        return false
      }

      return null
    },
    [challengeId, profileId, duration, completed],
  )

  async function toggleDay(dayNumber: number, currentDay: number): Promise<ToggleProgressResult> {
    if (!challengeId || !profileId) return { error: 'Sem sessão ativa.' }
    if (dayNumber > currentDay) return { error: 'Este dia ainda não foi liberado.' }

    const alreadyCompleted = completedDays.has(dayNumber)
    const nextDays = new Set(completedDays)

    if (alreadyCompleted) {
      const { error: deleteError } = await supabase
        .from('challenge_progress')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('profile_id', profileId)
        .eq('day_number', dayNumber)

      if (deleteError) return { error: deleteError.message }
      nextDays.delete(dayNumber)
    } else {
      const { error: insertError } = await supabase.from('challenge_progress').insert({
        challenge_id: challengeId,
        profile_id: profileId,
        day_number: dayNumber,
      })

      if (insertError) return { error: insertError.message }
      nextDays.add(dayNumber)
    }

    setCompletedDays(nextDays)
    await reconcileCompletion(nextDays.size)
    return { error: null }
  }

  const allDaysDone = duration > 0 && completedDays.size >= duration

  return { completedDays, completed, allDaysDone, loading, error, toggleDay, refresh: fetchProgress }
}
