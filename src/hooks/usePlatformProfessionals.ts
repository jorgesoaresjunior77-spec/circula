import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlatformProfessional } from '../types/platform'

// Fase 9 — visão agregada por profissional (RPC platform_professionals).
// Sem dados individuais de membros; só quem administra o quê e números.

export function usePlatformProfessionals() {
  const [professionals, setProfessionals] = useState<PlatformProfessional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfessionals = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('platform_professionals')

    if (rpcError) {
      setError(rpcError.message)
      setProfessionals([])
      setLoading(false)
      return
    }

    setProfessionals((data as PlatformProfessional[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfessionals()
  }, [fetchProfessionals])

  return { professionals, loading, error, refresh: fetchProfessionals }
}
