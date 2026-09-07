import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface BillingNotice {
  id: string
  title: string
  body: string
  related_subscription_id: string | null
  read_at: string | null
  created_at: string
}

// FASE 16.2.4-C — expõe as notificações de cobrança escritas pelo sweep
// (`billing-daily-sweep`) e pela `asaas-cancel-subscription` na tabela
// `public.notifications` (type='billing'). Até agora essa tabela não
// tinha consumidor no app.
//
// Leitura: RLS `notifications_select` = `profile_id = auth.uid()`.
// Marcar como lida: RLS `notifications_update_own`.
// `useBillingNotices(null)` não faz fetch.
export function useBillingNotices(subscriptionId: string | null) {
  const [notices, setNotices] = useState<BillingNotice[]>([])
  const [loading, setLoading] = useState(!!subscriptionId)

  const refresh = useCallback(async () => {
    if (!subscriptionId) {
      setNotices([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, related_subscription_id, read_at, created_at')
      .eq('type', 'billing')
      .eq('related_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotices((data as BillingNotice[] | null) ?? [])
    setLoading(false)
  }, [subscriptionId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const unread = notices.filter((n) => n.read_at === null)

  async function markRead(id: string) {
    const now = new Date().toISOString()
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null)
    if (error) await refresh()
  }

  return { notices, unread, loading, refresh, markRead }
}
