import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gardenErrorMessage } from '../types/garden'
import type {
  GardenChallenge,
  GardenChallengeDay,
  GardenChallengeDayInput,
  GardenChallengeInput,
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

const ENROLLMENT_SELECT =
  'id,challenge_id,profile_id,enrolled_at,profile:profiles(id,full_name,avatar_url)'

const COMPLETION_SELECT = 'id,challenge_id,challenge_day_id,enrollment_id,profile_id,completed_at'

/**
 * Painel profissional · Meu Jardim — gestão de desafios (CRUD, geração
 * de dias, publicação, arquivamento, participantes/progresso e
 * publicação de incentivo no feed).
 *
 * Mesmo molde de useEvents/useCircles: um hook por tela, fetch em
 * useCallback, listas auxiliares (dias/participantes/conclusões)
 * carregadas sob demanda por desafio (Record<challengeId, T[]>) — um
 * desafio pode ter muitos dias/participantes e não faz sentido buscar
 * tudo de todos os desafios de uma vez.
 *
 * useGardenChallenges(null) não faz fetch.
 */
export function useGardenChallenges(communityId: string | null) {
  const [challenges, setChallenges] = useState<GardenChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [daysByChallenge, setDaysByChallenge] = useState<Record<string, GardenChallengeDay[]>>({})
  const [daysLoading, setDaysLoading] = useState<Record<string, boolean>>({})
  /** Erro da última busca de dias por desafio — distingue "falhou ao carregar" de "carregou e não há dias". `null` = sem erro (nunca buscou, ainda carregando, ou carregou com sucesso). */
  const [daysError, setDaysError] = useState<Record<string, string | null>>({})
  /** Contador de sequência por desafio (não é estado — não precisa re-render). Cada fetchDays() incrementa o seu antes de buscar; ao terminar, só aplica o resultado se ainda for a chamada mais recente para aquele desafio — uma resposta antiga que chega depois de uma mais nova é descartada. */
  const daysRequestSeq = useRef<Record<string, number>>({})

  const [participantsByChallenge, setParticipantsByChallenge] = useState<
    Record<string, GardenEnrollment[]>
  >({})
  const [completionsByChallenge, setCompletionsByChallenge] = useState<
    Record<string, GardenCompletion[]>
  >({})
  const [progressLoading, setProgressLoading] = useState<Record<string, boolean>>({})
  /**
   * Etapa X — erro da última busca de participantes/conclusões por desafio,
   * mesmo papel de `daysError` para `fetchDays`: distingue "falhou ao
   * carregar" de "carregou e não há participantes/conclusões". `null` = sem
   * erro (nunca buscou, ainda carregando, ou carregou com sucesso). Dois
   * estados (em vez de um só) porque são duas consultas independentes — a
   * aba "Progresso" decide como combiná-los na exibição.
   */
  const [participantsError, setParticipantsError] = useState<Record<string, string | null>>({})
  const [completionsError, setCompletionsError] = useState<Record<string, string | null>>({})
  /**
   * Etapa X — contador de sequência por desafio para participantes+conclusões,
   * mesmo padrão de `daysRequestSeq`: `fetchProgress` incrementa antes de
   * buscar; `fetchParticipants`/`fetchCompletions` só aplicam seu resultado
   * (dado, erro ou exceção) se ainda forem a chamada mais recente para aquele
   * desafio — evita que uma resposta antiga (de uma troca de desafio ou de um
   * "Tentar novamente" anterior) sobrescreva uma mais nova que já terminou.
   */
  const progressRequestSeq = useRef<Record<string, number>>({})
  /**
   * Etapa AA (Finding 1) — sequência da busca principal de desafios (não é
   * estado — não precisa re-render). Sem chave por id porque há só UM fluxo
   * de "challenges" por vez (diferente de daysRequestSeq/progressRequestSeq,
   * que são por desafio). Protege contra uma resposta antiga sobrescrever o
   * resultado de uma chamada mais nova — ex.: clicar em "Tentar novamente"
   * duas vezes rápido, ou uma troca de comunidade enquanto a busca anterior
   * ainda está em voo.
   */
  const challengesRequestSeq = useRef(0)

  const fetchChallenges = useCallback(async () => {
    if (!communityId) {
      setChallenges([])
      setLoading(false)
      return
    }

    const seq = ++challengesRequestSeq.current
    const isLatest = () => challengesRequestSeq.current === seq

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('garden_challenges')
        .select(CHALLENGE_SELECT)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })

      if (!isLatest()) return

      if (fetchError) {
        setError(fetchError.message)
        setChallenges([])
        return
      }

      setChallenges((data as unknown as GardenChallenge[] | null) ?? [])
    } catch (err) {
      // Etapa AA (Finding 1) — exceção de verdade (rejeição de rede, etc.),
      // não um {error} do PostgREST. Antes, nada aqui era capturado:
      // `loading` ficava travado em `true` para sempre e a tela de
      // "Desafios da comunidade" nunca saía de "Carregando desafios..." —
      // sem nenhum jeito de perceber a falha ou tentar de novo. Mesmo
      // tratamento (cai no mesmo canal `error` de sempre) já usado em
      // `fetchDays`/`fetchParticipants`/`fetchCompletions` para esse
      // cenário.
      if (!isLatest()) return
      const message = err instanceof Error ? err.message : 'Não foi possível carregar os desafios agora.'
      setError(message)
      setChallenges([])
    } finally {
      if (isLatest()) {
        setLoading(false)
      }
    }
  }, [communityId])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  async function createChallenge(
    createdBy: string,
    input: GardenChallengeInput,
  ): Promise<GardenResult & { id?: string }> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { data, error: insertError } = await supabase
      .from('garden_challenges')
      .insert({
        community_id: communityId,
        created_by: createdBy,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        duration_days: input.duration_days,
        starts_on: input.starts_on,
        enrollment_opens_at: input.enrollment_opens_at,
        enrollment_closes_at: input.enrollment_closes_at,
        allow_late_enrollment: input.allow_late_enrollment,
        cover_image_url: input.cover_image_url,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    await fetchChallenges()
    return { error: null, id: data?.id }
  }

  async function updateChallenge(
    challengeId: string,
    input: GardenChallengeInput,
  ): Promise<GardenResult> {
    const { error: updateError } = await supabase
      .from('garden_challenges')
      .update({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        duration_days: input.duration_days,
        starts_on: input.starts_on,
        enrollment_opens_at: input.enrollment_opens_at,
        enrollment_closes_at: input.enrollment_closes_at,
        allow_late_enrollment: input.allow_late_enrollment,
        cover_image_url: input.cover_image_url,
      })
      .eq('id', challengeId)

    if (updateError) return { error: updateError.message }

    await fetchChallenges()
    return { error: null }
  }

  /** Gera (substituindo) os dias do desafio — só enquanto 'draft'. */
  async function generateDays(challengeId: string): Promise<GardenResult> {
    const { error: rpcError } = await supabase.rpc('garden_generate_challenge_days', {
      p_challenge_id: challengeId,
    })

    if (rpcError) return { error: gardenErrorMessage(rpcError.message) }

    await fetchDays(challengeId)
    return { error: null }
  }

  async function publishChallenge(challengeId: string): Promise<GardenResult> {
    const { error: rpcError } = await supabase.rpc('garden_publish_challenge', {
      p_challenge_id: challengeId,
    })

    if (rpcError) return { error: gardenErrorMessage(rpcError.message) }

    await fetchChallenges()
    return { error: null }
  }

  async function archiveChallenge(challengeId: string): Promise<GardenResult> {
    const { error: updateError } = await supabase
      .from('garden_challenges')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', challengeId)

    if (updateError) return { error: updateError.message }

    await fetchChallenges()
    return { error: null }
  }

  /** Só desafios vazios (rascunho, sem dias) podem ser excluídos — a
   *  RESTRICT das FKs barra no banco mesmo se algo escapar na UI. */
  async function deleteChallenge(challengeId: string): Promise<GardenResult> {
    const { error: deleteError } = await supabase
      .from('garden_challenges')
      .delete()
      .eq('id', challengeId)

    if (deleteError) {
      if (deleteError.code === '23503') {
        return { error: 'Este desafio tem histórico (dias/inscrições) e não pode ser excluído — arquive-o.' }
      }
      return { error: deleteError.message }
    }

    setChallenges((prev) => prev.filter((c) => c.id !== challengeId))
    return { error: null }
  }

  const fetchDays = useCallback(async (challengeId: string) => {
    // Sequência própria desta chamada: se outra fetchDays(challengeId) mais
    // nova começar antes desta terminar, o número guardado em
    // daysRequestSeq.current[challengeId] avança para o dela — e esta
    // chamada, ao terminar, percebe que não é mais a mais recente (isLatest
    // abaixo) e não aplica nenhum resultado seu (sucesso, erro ou fim de
    // carregamento), evitando que uma resposta antiga sobrescreva uma mais
    // nova, mesmo que termine depois.
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
        // Não mexe em daysByChallenge — o que já estava carregado (se algo
        // estava) permanece, mas quem consome precisa checar daysError
        // antes de interpretar `days.length === 0` como "não há dias".
        setDaysError((prev) => ({ ...prev, [challengeId]: fetchError.message }))
        return { error: fetchError.message }
      }

      setDaysByChallenge((prev) => ({
        ...prev,
        [challengeId]: (data as unknown as GardenChallengeDay[] | null) ?? [],
      }))
      return { error: null }
    } catch (err) {
      // Exceção de verdade (rejeição de rede, etc.) — não um {error} do
      // PostgREST. Sem isto, o catch não existiria e daysLoading ficaria
      // travado em `true` para sempre (o setDaysLoading(false) do finally
      // abaixo é o que garante o desligamento mesmo neste caminho).
      if (!isLatest()) return { error: null }
      const message = err instanceof Error ? err.message : 'Não foi possível carregar os dias agora.'
      setDaysError((prev) => ({ ...prev, [challengeId]: message }))
      return { error: message }
    } finally {
      // Só a chamada mais recente desliga o carregamento — uma chamada
      // antiga que termina depois (sucesso, erro ou exceção) nunca reabaixa
      // daysLoading enquanto uma chamada mais nova ainda estiver em voo.
      if (isLatest()) {
        setDaysLoading((prev) => ({ ...prev, [challengeId]: false }))
      }
    }
  }, [])

  async function updateDay(
    challengeId: string,
    dayId: string,
    input: GardenChallengeDayInput,
  ): Promise<GardenResult> {
    const { error: updateError } = await supabase
      .from('garden_challenge_days')
      .update({
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        icon: input.icon?.trim() || null,
        encouragement_message: input.encouragement_message?.trim() || null,
        activity_date: input.activity_date,
      })
      .eq('id', dayId)

    if (updateError) return { error: updateError.message }

    await fetchDays(challengeId)
    return { error: null }
  }

  /**
   * Etapa X — `seq` vem de `fetchProgress` (única chamadora): aplica dado,
   * erro ou exceção só se `progressRequestSeq.current[challengeId]` ainda for
   * esse `seq` no momento em que a resposta chega (mesmo princípio de
   * `fetchDays`/`isLatest`). Não é mais exportada fora do hook — nunca foi
   * (só `fetchProgress` é devolvida), então mudar sua assinatura interna não
   * afeta nenhum consumidor existente.
   */
  const fetchParticipants = useCallback(async (challengeId: string, seq: number) => {
    const isLatest = () => progressRequestSeq.current[challengeId] === seq
    try {
      const { data, error: fetchError } = await supabase
        .from('garden_enrollments')
        .select(ENROLLMENT_SELECT)
        .eq('challenge_id', challengeId)
        .order('enrolled_at', { ascending: false })

      if (!isLatest()) return

      if (fetchError) {
        setParticipantsError((prev) => ({ ...prev, [challengeId]: fetchError.message }))
        return
      }

      setParticipantsByChallenge((prev) => ({
        ...prev,
        [challengeId]: (data as unknown as GardenEnrollment[] | null) ?? [],
      }))
    } catch (err) {
      if (!isLatest()) return
      const message = err instanceof Error ? err.message : 'Não foi possível carregar os participantes agora.'
      setParticipantsError((prev) => ({ ...prev, [challengeId]: message }))
    }
  }, [])

  const fetchCompletions = useCallback(async (challengeId: string, seq: number) => {
    const isLatest = () => progressRequestSeq.current[challengeId] === seq
    try {
      const { data, error: fetchError } = await supabase
        .from('garden_completions')
        .select(COMPLETION_SELECT)
        .eq('challenge_id', challengeId)

      if (!isLatest()) return

      if (fetchError) {
        setCompletionsError((prev) => ({ ...prev, [challengeId]: fetchError.message }))
        return
      }

      setCompletionsByChallenge((prev) => ({
        ...prev,
        [challengeId]: (data as unknown as GardenCompletion[] | null) ?? [],
      }))
    } catch (err) {
      if (!isLatest()) return
      const message = err instanceof Error ? err.message : 'Não foi possível carregar as conclusões agora.'
      setCompletionsError((prev) => ({ ...prev, [challengeId]: message }))
    }
  }, [])

  /**
   * Carrega participantes + conclusões de uma vez (aba "Progresso" do
   * desafio). Etapa X — ganhou o mesmo contador de sequência de `fetchDays`
   * (`progressRequestSeq`): reabrir a aba ou clicar em "Tentar novamente"
   * enquanto uma busca anterior ainda está em voo não deixa a resposta antiga
   * desligar `progressLoading` por cima da busca mais nova.
   */
  async function fetchProgress(challengeId: string) {
    const seq = (progressRequestSeq.current[challengeId] ?? 0) + 1
    progressRequestSeq.current[challengeId] = seq
    const isLatest = () => progressRequestSeq.current[challengeId] === seq

    setProgressLoading((prev) => ({ ...prev, [challengeId]: true }))
    setParticipantsError((prev) => ({ ...prev, [challengeId]: null }))
    setCompletionsError((prev) => ({ ...prev, [challengeId]: null }))

    await Promise.all([fetchParticipants(challengeId, seq), fetchCompletions(challengeId, seq)])

    if (isLatest()) {
      setProgressLoading((prev) => ({ ...prev, [challengeId]: false }))
    }
  }

  async function publishDailyPost(
    challengeDayId: string,
    message: string,
  ): Promise<GardenResult> {
    const { error: rpcError } = await supabase.rpc('garden_publish_daily_post', {
      p_challenge_day_id: challengeDayId,
      p_message: message,
    })

    if (rpcError) return { error: gardenErrorMessage(rpcError.message) }
    return { error: null }
  }

  return {
    challenges,
    loading,
    error,
    createChallenge,
    updateChallenge,
    generateDays,
    publishChallenge,
    archiveChallenge,
    deleteChallenge,
    daysByChallenge,
    daysLoading,
    daysError,
    fetchDays,
    updateDay,
    participantsByChallenge,
    completionsByChallenge,
    progressLoading,
    participantsError,
    completionsError,
    fetchProgress,
    publishDailyPost,
    refresh: fetchChallenges,
  }
}
