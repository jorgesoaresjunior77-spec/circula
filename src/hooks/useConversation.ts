import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Message, MessageResult } from '../types/message'

// Módulo MENSAGENS — thread de uma conversa.
// useConversation(null, ...) não faz fetch.
//
// - mensagens ordenadas por created_at asc (limite fixo, sem paginação
//   infinita neste módulo)
// - Realtime: canal por conversa (INSERT em messages filtrado por
//   conversation_id). O próprio INSERT da usuária também volta pelo
//   canal; o append deduplica por id, então não há mensagem dobrada.
// - otherLastReadAt: last_read_at do outro participante, relido a cada
//   nova mensagem e ao focar a janela — base do indicador "lida".

const MESSAGE_SELECT = 'id,conversation_id,sender_id,body,created_at'
const MESSAGE_LIMIT = 200

function sortByCreatedAt(list: Message[]): Message[] {
  return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function useConversation(conversationId: string | null, myProfileId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const mountedRef = useRef(true)

  const fetchParticipants = useCallback(async () => {
    if (!conversationId || !myProfileId) return
    const { data } = await supabase
      .from('conversation_participants')
      .select('profile_id,last_read_at')
      .eq('conversation_id', conversationId)
    if (!mountedRef.current || !data) return
    const other = (data as { profile_id: string; last_read_at: string | null }[]).find(
      (row) => row.profile_id !== myProfileId,
    )
    setOtherLastReadAt(other?.last_read_at ?? null)
  }, [conversationId, myProfileId])

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MESSAGE_LIMIT)

    if (!mountedRef.current) return

    if (fetchError) {
      setError(fetchError.message)
      setMessages([])
      setLoading(false)
      return
    }

    setError(null)
    setMessages(sortByCreatedAt((data as Message[] | null) ?? []))
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    setMessages([])
    setOtherLastReadAt(null)
    fetchMessages()
    fetchParticipants()
    return () => {
      mountedRef.current = false
    }
  }, [fetchMessages, fetchParticipants])

  const markRead = useCallback(async () => {
    if (!conversationId) return
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
  }, [conversationId])

  // Realtime da thread aberta.
  useEffect(() => {
    if (!conversationId || !myProfileId) return

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Message
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : sortByCreatedAt([...prev, row]),
          )
          if (row.sender_id !== myProfileId) {
            markRead()
          }
          fetchParticipants()
        },
      )
      .subscribe()

    function handleFocus() {
      fetchParticipants()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [conversationId, myProfileId, markRead, fetchParticipants])

  async function sendMessage(body: string): Promise<MessageResult> {
    if (!conversationId || !myProfileId) return { error: 'Conversa inválida.' }
    const trimmed = body.trim()
    if (!trimmed) return { error: null }

    setSending(true)
    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: myProfileId, body: trimmed })
      .select(MESSAGE_SELECT)
      .single()
    setSending(false)

    if (insertError) return { error: insertError.message }

    // Append imediato (o Realtime também traz, mas deduplica por id).
    if (data) {
      const row = data as Message
      setMessages((prev) =>
        prev.some((m) => m.id === row.id) ? prev : sortByCreatedAt([...prev, row]),
      )
    }
    return { error: null }
  }

  return {
    messages,
    otherLastReadAt,
    loading,
    error,
    sending,
    sendMessage,
    markRead,
    refresh: fetchMessages,
  }
}
