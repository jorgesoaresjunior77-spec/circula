import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { circleRequestErrorMessage } from '../types/circleRequest'
import type {
  CircleRequest,
  CircleRequestInput,
  CircleRequestResult,
  CircleRequestStatus,
} from '../types/circleRequest'

// Etapa 5 (evolução/experiência/gamificação) — Solicitação de novo
// Círculo. UM hook só, reutilizado tanto pelo Member (criar + ver as
// PRÓPRIAS solicitações) quanto pela Profissional (ver e revisar TODAS
// as da comunidade): a RLS de `circle_requests` já resolve sozinha quem
// vê o quê (própria autora OU dona da comunidade, nunca as duas listas
// misturadas por engano) — mesmo princípio de useCommunityCardImages,
// sem duplicar hook por papel.
//
// useCircleRequests(null, null) não faz fetch.

const REQUEST_SELECT =
  'id,community_id,profile_id,suggested_name,topic,reason,activities,visual_idea,notes,' +
  'reference_image_path,status,professional_note,created_at,reviewed_at,reviewed_by,' +
  'profile:profiles!circle_requests_profile_id_fkey(id,full_name,avatar_url)'

export function useCircleRequests(communityId: string | null, profileId: string | null) {
  const [requests, setRequests] = useState<CircleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    if (!communityId) {
      setRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('circle_requests')
      .select(REQUEST_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRequests([])
      setLoading(false)
      return
    }

    setRequests((data as unknown as CircleRequest[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  /** Minhas solicitações (RLS já filtra; aqui só facilita achar a mais
   *  recente/pendente sem o chamador precisar repetir o filtro). */
  const myRequests = profileId ? requests.filter((r) => r.profile_id === profileId) : []
  const myPendingRequest = myRequests.find((r) => r.status === 'pending') ?? null

  async function createRequest(
    createdBy: string,
    input: CircleRequestInput,
  ): Promise<CircleRequestResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('circle_requests').insert({
      community_id: communityId,
      profile_id: createdBy,
      suggested_name: input.suggested_name.trim(),
      topic: input.topic?.trim() || null,
      reason: input.reason?.trim() || null,
      activities: input.activities?.trim() || null,
      visual_idea: input.visual_idea?.trim() || null,
      notes: input.notes?.trim() || null,
      reference_image_path: input.reference_image_path?.trim() || null,
    })

    if (insertError) return { error: circleRequestErrorMessage(insertError.message) }

    await fetchRequests()
    return { error: null }
  }

  /** Só a dona consegue de verdade (RLS) — a UI da Profissional é a
   *  única que chama isto; para a Member, o botão de revisão nunca
   *  aparece. */
  async function updateStatus(
    requestId: string,
    status: CircleRequestStatus,
    reviewerId: string,
    professionalNote?: string | null,
  ): Promise<CircleRequestResult> {
    const patch: {
      status: CircleRequestStatus
      reviewed_at: string
      reviewed_by: string
      professional_note?: string | null
    } = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    }
    if (professionalNote !== undefined) patch.professional_note = professionalNote?.trim() || null

    const { error: updateError } = await supabase
      .from('circle_requests')
      .update(patch)
      .eq('id', requestId)

    if (updateError) return { error: updateError.message }

    await fetchRequests()
    return { error: null }
  }

  return {
    requests,
    myRequests,
    myPendingRequest,
    loading,
    error,
    createRequest,
    updateStatus,
    refresh: fetchRequests,
  }
}
