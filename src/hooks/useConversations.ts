import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ConversationOverview, StartConversationResult } from '../types/message'

// Módulo MENSAGENS — lista/visão geral das conversas da usuária logada.
// useConversations(null) não faz fetch (usado para o Master, que não
// tem Mensagens).
//
// Realtime: uma assinatura em `messages` INSERT (a RLS entrega só o que
// é das conversas da usuária) dispara `refresh()`. Se o canal não
// conectar, o hook continua funcionando com refresh manual + refetch
// ao focar a janela. Sem dependência nova — cliente Realtime já vem no
// @supabase/supabase-js.

// Foco da janela: só reconsulta se passou mais de 1 min; mensagens em rajada
// (Realtime) viram uma única consulta.
const MIN_FOCUS_REFRESH_MS = 60_000
const REALTIME_DEBOUNCE_MS = 1500

export function useConversations(profileId: string | null) {
  const [conversations, setConversations] = useState<ConversationOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const lastRefreshRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!profileId) {
      setConversations([])
      setLoading(false)
      return
    }

    lastRefreshRef.current = Date.now()
    const { data, error: rpcError } = await supabase.rpc('conversations_overview')

    if (!mountedRef.current) return

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    setError(null)
    setConversations((data as ConversationOverview[] | null) ?? [])
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  // Realtime: novas mensagens -> revalida a visão geral.
  useEffect(() => {
    if (!profileId) return

    let debounce: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel(`messages-overview-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          if (debounce) clearTimeout(debounce)
          debounce = setTimeout(() => void refresh(), REALTIME_DEBOUNCE_MS)
        },
      )
      .subscribe()

    function handleFocus() {
      if (Date.now() - lastRefreshRef.current > MIN_FOCUS_REFRESH_MS) refresh()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      if (debounce) clearTimeout(debounce)
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [profileId, refresh])

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unread_count || 0), 0),
    [conversations],
  )

  async function startConversation(otherProfileId: string): Promise<StartConversationResult> {
    const { data, error: rpcError } = await supabase.rpc(
      'get_or_create_direct_conversation',
      { p_other: otherProfileId },
    )

    if (rpcError) return { id: null, error: rpcError.message }

    await refresh()
    return { id: (data as string | null) ?? null, error: null }
  }

  return {
    conversations,
    loading,
    error,
    totalUnread,
    refresh,
    startConversation,
  }
}
