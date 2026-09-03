import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { HelpRequest, HelpRequestReply, HelpResult, HelpStatus } from '../types/help'

// Fase 5 — visão da NUTRI: a fila de pedidos de ajuda da comunidade que
// ela administra. A RLS de help_requests entrega TODOS os pedidos da
// comunidade para a dona (owns_community). A Nutri move o status, mas
// NÃO apaga o pedido da usuária (não há deleteRequest aqui).
//
// useHelpQueue(null, ...) não faz fetch.

// help_requests tem 2 FKs para profiles (profile_id e resolved_by); o
// embed precisa nomear a FK, senão o PostgREST responde 300 (ambíguo).
const REQUEST_SELECT =
  'id,community_id,profile_id,audience,body,status,related_conversation_id,' +
  'created_at,updated_at,resolved_at,resolved_by,' +
  'author:profiles!help_requests_profile_id_fkey(id,full_name,avatar_url)'

const REPLY_SELECT =
  'id,help_request_id,profile_id,body,created_at,' +
  'author:profiles!help_request_replies_profile_id_fkey(id,full_name,avatar_url)'

export function useHelpQueue(communityId: string | null, profileId: string | null) {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [repliesByRequest, setRepliesByRequest] = useState<Record<string, HelpRequestReply[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
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
    fetchQueue()
  }, [fetchQueue])

  const byStatus = useMemo(() => {
    const groups: Record<HelpStatus, HelpRequest[]> = {
      open: [],
      in_progress: [],
      resolved: [],
    }
    for (const req of requests) groups[req.status].push(req)
    return groups
  }, [requests])

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

  async function setStatus(requestId: string, status: HelpStatus): Promise<HelpResult> {
    const patch: Record<string, unknown> = { status }
    if (status === 'resolved') {
      patch.resolved_at = new Date().toISOString()
      patch.resolved_by = profileId
    } else {
      patch.resolved_at = null
      patch.resolved_by = null
    }

    const { error: updateError } = await supabase
      .from('help_requests')
      .update(patch)
      .eq('id', requestId)

    if (updateError) return { error: updateError.message }

    await fetchQueue()
    return { error: null }
  }

  async function addReply(requestId: string, body: string): Promise<HelpResult> {
    if (!profileId) return { error: 'Sem sessão ativa.' }
    const trimmed = body.trim()
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
    byStatus,
    repliesByRequest,
    loading,
    error,
    setStatus,
    addReply,
    fetchReplies,
    refresh: fetchQueue,
  }
}
