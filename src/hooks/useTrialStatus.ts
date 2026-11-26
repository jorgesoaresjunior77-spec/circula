import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Teste grátis de 21 dias da membro nesta comunidade (linha de `subscriptions`).
// Consulta leve: só status e data. `active` = ainda dentro dos 21 dias.

export interface TrialStatus {
  status: string | null
  trialEndsAt: string | null
  /** Em teste e a data ainda não passou. */
  active: boolean
  loading: boolean
}

interface Row {
  status: string
  trial_ends_at: string | null
}

export function useTrialStatus(communityId: string | null, profileId: string | null, enabled: boolean): TrialStatus {
  const key = enabled && communityId && profileId ? `${communityId}:${profileId}` : null
  const [state, setState] = useState<{ key: string; row: Row | null } | null>(null)

  useEffect(() => {
    if (!key || !communityId || !profileId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status,trial_ends_at')
        .eq('subject', 'community')
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .neq('status', 'canceled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setState({ key, row: (data as Row | null) ?? null })
    })()
    return () => {
      cancelled = true
    }
  }, [key, communityId, profileId])

  const ready = !key || state?.key === key
  const row = key && state?.key === key ? state.row : null
  const active = !!row && row.status === 'trial' && !!row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now()
  return { status: row?.status ?? null, trialEndsAt: row?.trial_ends_at ?? null, active, loading: !ready }
}
