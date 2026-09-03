import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  HelpRequest,
  HelpRequestInput,
  HelpRequestReply,
  HelpResult,
} from '../types/help'

// Fase 5 — visão da USUÁRIA sobre os pedidos de ajuda.
//
// A RLS de help_requests já entrega: os pedidos "para a comunidade" +
// os pedidos "para a Nutri" DELA (nunca os privados de outra pessoa).
//
// Pedido "para a Nutri": reaproveita a RPC existente
// get_or_create_direct_conversation, guarda o conversation_id e posta a
// mensagem de abertura em `messages` (RLS de messages_insert já
// existente — sem tocar em código de Mensagens).
//
// useHelpRequests(null, ...) não faz fetch.

// help_requests tem 2 FKs para profiles (profile_id e resolved_by); o
// embed precisa nomear a FK, senão o PostgREST responde 300 (ambíguo).
const REQUEST_SELECT =
  'id,community_id,profile_id,audience,body,status,related_conversation_id,' +
  'created_at,updated_at,resolved_at,resolved_by,' +
  'author:profiles!help_requests_profile_id_fkey(id,full_name,avatar_url)'

const REPLY_SELECT =
  'id,help_request_id,profile_id,body,created_at,' +
  'author:profiles!help_request_replies_profile_id_fkey(id,full_name,avatar_url)'

function cleanBody(value: string): string {
  return value.trim()
}

export function useHelpRequests(
  communityId: string | null,
  profileId: string | null,
  communityOwnerId: string | null,
) {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [repliesByRequest, setRepliesByRequest] = useState<Record<string, HelpRequestReply[]>>({})
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
      .from('help_requests')
      .select(REQUEST_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRequests([])
      setLoading(false)
      return
    }

    setRequests((data as unknown as HelpRequest[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  async function fetchReplies(requestId: string): Promise<HelpResult> {
    const { data, error: fetchError } = await supabase
      .from('help_request_replies')
      .select(REPLY_SELECT)
      .eq('help_request_id', requestId)
      .order('created_at', { ascending: true })

    if (fetchError) return { error: fetchError.message }

    setRepliesByRequest((prev) => ({
      ...prev,
      [requestId]: (data as unknown as HelpRequestReply[] | null) ?? [],
    }))
    return { error: null }
  }

  async function createRequest(
    input: HelpRequestInput,
  ): Promise<HelpResult & { requestId?: string; conversationId?: string | null }> {
    if (!communityId || !profileId) return { error: 'Sem comunidade selecionada.' }
    const body = cleanBody(input.body)
    if (!body) return { error: 'Escreva o seu pedido antes de enviar.' }

    let conversationId: string | null = null

    if (input.audience === 'nutri') {
      if (!communityOwnerId) return { error: 'Comunidade sem anfitriã definida.' }
      const { data: convData, error: rpcError } = await supabase.rpc(
        'get_or_create_direct_conversation',
        { p_other: communityOwnerId },
      )
      if (rpcError) return { error: rpcError.message }
      conversationId = (convData as string | null) ?? null
    }

    const { data: inserted, error: insertError } = await supabase
      .from('help_requests')
      .insert({
        community_id: communityId,
        profile_id: profileId,
        audience: input.audience,
        body,
        related_conversation_id: conversationId,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    const requestId = (inserted as { id: string } | null)?.id

    // Mensagem de abertura na conversa (só para 'nutri'). Uma falha aqui
    // não invalida o pedido, que já foi criado.
    if (input.audience === 'nutri' && conversationId) {
      await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: profileId, body })
    }

    await fetchRequests()
    return { error: null, requestId, conversationId }
  }

  async function updateRequest(requestId: string, body: string): Promise<HelpResult> {
    const trimmed = cleanBody(body)
    if (!trimmed) return { error: 'Escreva algo antes de salvar.' }

    const { error: updateError } = await supabase
      .from('help_requests')
      .update({ body: trimmed })
      .eq('id', requestId)

    if (updateError) return { error: updateError.message }

    await fetchRequests()
    return { error: null }
  }

  async function deleteRequest(requestId: string): Promise<HelpResult> {
    const { error: deleteError } = await supabase
      .from('help_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) return { error: deleteError.message }

    setRequests((prev) => prev.filter((r) => r.id !== requestId))
    return { error: null }
  }

  async function addReply(requestId: string, body: string): Promise<HelpResult> {
    if (!profileId) return { error: 'Sem sessão ativa.' }
    const trimmed = cleanBody(body)
    if (!trimmed) return { error: 'Escreva uma resposta.' }

    const { error: insertError } = await supabase
      .from('help_request_replies')
      .insert({ help_request_id: requestId, profile_id: profileId, body: trimmed })

    if (insertError) return { error: insertError.message }

    await fetchReplies(requestId)
    return { error: null }
  }

  return {
    requests,
    repliesByRequest,
    loading,
    error,
    createRequest,
    updateRequest,
    deleteRequest,
    addReply,
    fetchReplies,
    refresh: fetchRequests,
  }
}
