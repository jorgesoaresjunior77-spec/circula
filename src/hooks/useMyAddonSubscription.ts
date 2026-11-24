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
        // a assinatura própria do plano ou uma cesta que inclui o plano
        .or(`plan_key.eq.${planKey},bundle_keys.cs.{${planKey}}`)
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
      // numa cesta, cancela só o conteúdo desta página (cada um é independente)
      body: sub.plan_key === 'cesta' ? { addon_id: sub.id, package_key: planKey } : { addon_id: sub.id },
    })
    setBusy(false)
    if (invokeError) {
      setError('Não foi possível cancelar agora. Tente novamente em instantes.')
      return false
    }
    setToken((n) => n + 1)
    return true
  }, [sub, planKey])

  return { sub, busy, error, cancel }
}
