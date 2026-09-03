import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlatformOverview } from '../types/platform'

// Fase 9 — KPIs agregados da plataforma inteira (RPC platform_overview).
// SECURITY DEFINER com guard is_master(); qualquer não-Master recebe
// `not_authorized`. Uma única chamada.

export function usePlatformOverview() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('platform_overview')

    if (rpcError) {
      setError(rpcError.message)
      setOverview(null)
      setLoading(false)
      return
    }

    setOverview(data as PlatformOverview)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  return { overview, loading, error, refresh: fetchOverview }
}
