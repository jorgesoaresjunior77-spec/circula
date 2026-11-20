import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A assinatura avulsa (ou Premium) da própria membro para um plano: serve para
// mostrar "até quando tenho acesso" e para cancelar. A RLS só devolve as dela.

export interface MyAddonSubscription {
  id: string
  plan_key: string
  status: 'pending' | 'active' | 'past_due' | 'canceled'
  current_period_end: string | null
}

export function useMyAddonSubscription(communityId: string | null, profileId: string | null, planKey: string) {
  const [sub, setSub] = useState<MyAddonSubscription | null>(null)
  const [token, setToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!communityId || !profileId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('addon_subscriptions')
        .select('id,plan_key,status,current_period_end')
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .eq('plan_key', planKey)
        .in('status', ['active', 'past_due', 'canceled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setSub((data as MyAddonSubscription | null) ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, planKey, token])

  const cancel = useCallback(async (): Promise<boolean> => {
    if (!sub) return false
    setBusy(true)
    setError(null)
    const { error: invokeError } = await supabase.functions.invoke('asaas-cancel-addon-subscription', {
      body: { addon_id: sub.id },
    })
    setBusy(false)
    if (invokeError) {
      setError('Não foi possível cancelar agora. Tente novamente em instantes.')
      return false
    }
    setToken((n) => n + 1)
    return true
  }, [sub])

  return { sub, busy, error, cancel }
}
