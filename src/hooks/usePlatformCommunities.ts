import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlatformCommunity } from '../types/platform'

// Fase 9 — visão agregada por comunidade (RPC platform_communities).
// Sem conteúdo, sem membros individuais — só identidade da comunidade,
// profissional responsável e números agregados.

export function usePlatformCommunities() {
  const [communities, setCommunities] = useState<PlatformCommunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommunities = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('platform_communities')

    if (rpcError) {
      setError(rpcError.message)
      setCommunities([])
      setLoading(false)
      return
    }

    setCommunities((data as PlatformCommunity[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCommunities()
  }, [fetchCommunities])

  return { communities, loading, error, refresh: fetchCommunities }
}
