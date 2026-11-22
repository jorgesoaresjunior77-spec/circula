import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A participante chegou por convite de quem tem o Premium e ainda não usou o
// desconto de 10% no Premium? (O servidor confere de novo ao cobrar.)
export function useReferralDiscount(communityId: string | null, enabled = true): boolean {
  const [eligible, setEligible] = useState(false)
  useEffect(() => {
    if (!communityId || !enabled) return
    let cancelled = false
    void supabase.rpc('my_referral_discount', { p_community_id: communityId }).then(({ data, error }) => {
      if (!cancelled) setEligible(!error && data === true)
    })
    return () => {
      cancelled = true
    }
  }, [communityId, enabled])
  return eligible
}
