import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NotificationResult, SocialNotification } from '../types/notification'

// Módulo NOTIFICAÇÕES SOCIAIS.
// Busca as notificações da usuária logada (RLS já restringe a
// profile_id = auth.uid(); o filtro explícito ativa o índice).
// useSocialNotifications(null) não faz fetch.
//
// Arquitetura preparada para Realtime: `refresh` é estável e pode ser
// chamada por uma subscription futura sem mudar o resto do hook.

const NOTIFICATION_SELECT =
  `id,profile_id,actor_profile_id,type,title,body,` +
  `related_post_id,related_comment_id,related_circle_id,related_event_id,related_challenge_id,` +
  `related_conversation_id,related_help_request_id,read_at,created_at,` +
  `actor:profiles!social_notifications_actor_profile_id_fkey(id,full_name,avatar_url)`

const PAGE_LIMIT = 50

export function useSocialNotifications(profileId: string | null) {
  const [notifications, setNotifications] = useState<SocialNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!profileId) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('social_notifications')
      .select(NOTIFICATION_SELECT)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT)

    if (fetchError) {
      setError(fetchError.message)
      setNotifications([])
      setLoading(false)
      return
    }

    setNotifications((data as unknown as SocialNotification[] | null) ?? [])
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.read_at === null).length,
    [notifications],
  )

  async function markRead(id: string): Promise<NotificationResult> {
    const target = notifications.find((item) => item.id === id)
    if (!target || target.read_at) return { error: null }

    const now = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read_at: now } : item)),
    )

    const { error: updateError } = await supabase
      .from('social_notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null)

    if (updateError) {
      await fetchNotifications()
      return { error: updateError.message }
    }
    return { error: null }
  }

  async function markAllRead(): Promise<NotificationResult> {
    if (!profileId || unreadCount === 0) return { error: null }

    const now = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: now })),
    )

    const { error: updateError } = await supabase
      .from('social_notifications')
      .update({ read_at: now })
      .eq('profile_id', profileId)
      .is('read_at', null)

    if (updateError) {
      await fetchNotifications()
      return { error: updateError.message }
    }
    return { error: null }
  }

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  }
}
