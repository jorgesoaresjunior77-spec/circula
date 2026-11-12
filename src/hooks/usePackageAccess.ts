import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PackageKey } from '../lib/packages'

// Pacotes liberados (tabela member_package_access). A RLS decide o que cada
// papel enxerga: a membro só as próprias linhas; a dona, as da comunidade.
// Se a consulta falhar (sem internet, tabela ainda não criada), o resultado
// é "nenhum pacote" — ou seja, bloqueado.

interface Row {
  profile_id: string
  package: PackageKey
}

/** Pacotes da própria membro nesta comunidade. */
export function useMyPackages(communityId: string | null, profileId: string | null, enabled = true) {
  const [state, setState] = useState<{ key: string; packages: Set<PackageKey> } | null>(null)
  const key = enabled && communityId && profileId ? `${communityId}:${profileId}` : null

  useEffect(() => {
    if (!key || !communityId || !profileId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('member_package_access')
        .select('profile_id,package')
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
      if (!cancelled) {
        setState({ key, packages: new Set(((data as Row[] | null) ?? []).map((r) => r.package)) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, communityId, profileId])

  const ready = !key || state?.key === key
  return { packages: key && state?.key === key ? state.packages : new Set<PackageKey>(), loading: !ready }
}

/** Visão da dona: todos os pacotes da comunidade, com liberar e retirar. */
export function useCommunityPackages(communityId: string | null) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(!!communityId)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data, error: fetchError } = await supabase
        .from('member_package_access')
        .select('profile_id,package')
        .eq('community_id', communityId)
      if (cancelled) return
      setError(fetchError ? 'Não foi possível carregar os pacotes agora.' : null)
      setRows((data as Row[] | null) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, token])

  const has = useCallback(
    (profileId: string, pkg: PackageKey) => rows.some((r) => r.profile_id === profileId && r.package === pkg),
    [rows],
  )

  const setAccess = useCallback(
    async (profileId: string, pkg: PackageKey, on: boolean, grantedBy: string): Promise<{ error: string | null }> => {
      if (!communityId) return { error: 'Comunidade não encontrada.' }
      const result = on
        ? await supabase
            .from('member_package_access')
            .insert({ community_id: communityId, profile_id: profileId, package: pkg, granted_by: grantedBy })
        : await supabase
            .from('member_package_access')
            .delete()
            .eq('community_id', communityId)
            .eq('profile_id', profileId)
            .eq('package', pkg)
      if (result.error) return { error: 'Não foi possível salvar agora.' }
      setToken((n) => n + 1)
      return { error: null }
    },
    [communityId],
  )

  return { loading, error, has, setAccess }
}
