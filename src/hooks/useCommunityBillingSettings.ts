import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityBillingSettings } from '../types/billing'

// FASE 16.1-P — lê e grava o preço da assinatura da comunidade.
// Leitura: SELECT direto (RLS `community_billing_settings_select` = USING(true)).
// Escrita: SOMENTE via RPC `set_community_price` (SECURITY DEFINER, guard
// owns_community + piso R$ 14,90 no servidor). O frontend NUNCA é a fonte
// de verdade do preço.
export function useCommunityBillingSettings(communityId: string | null) {
  const [settings, setSettings] = useState<CommunityBillingSettings | null>(null)
  const [loading, setLoading] = useState(!!communityId)

  const refresh = useCallback(async () => {
    if (!communityId) {
      setSettings(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('community_billing_settings')
      .select('community_id, price_cents, billing_cycle, currency, updated_at')
      .eq('community_id', communityId)
      .maybeSingle()
    setSettings((data as CommunityBillingSettings | null) ?? null)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function setPrice(priceCents: number, billingCycle: string) {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }
    const { error } = await supabase.rpc('set_community_price', {
      p_community_id: communityId,
      p_price_cents: priceCents,
      p_billing_cycle: billingCycle,
    })
    if (error) return { error: error.message }
    await refresh()
    return { error: null as string | null }
  }

  return { settings, loading, setPrice, refresh }
}
