import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityMetrics, MetricsPeriodDays } from '../types/communityMetrics'

export function useCommunityMetrics(communityId: string | null, periodDays: MetricsPeriodDays) {
  const [metrics, setMetrics] = useState<CommunityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!communityId) {
      setMetrics(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase.rpc('community_metrics', {
      p_community_id: communityId,
      p_period_days: periodDays,
    })

    if (fetchError) {
      setError(fetchError.message)
      setMetrics(null)
      setLoading(false)
      return
    }

    setMetrics(data as CommunityMetrics)
    setLoading(false)
  }, [communityId, periodDays])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refresh: fetchMetrics }
}
