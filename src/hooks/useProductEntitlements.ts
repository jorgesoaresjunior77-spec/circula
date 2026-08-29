import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface EntitlementRow {
  product_id: string
}

// Entitlements ATIVOS (revoked_at IS NULL) do usuário autenticado numa comunidade.
// A RLS de product_entitlements já restringe cada member às próprias linhas, então
// não é preciso filtrar por profile_id aqui. `enabled` desliga a consulta para
// papéis que não compram (Professional / Master).
export function useProductEntitlements(communityId: string, enabled: boolean) {
  const [ownedProductIds, setOwnedProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchEntitlements = useCallback(async () => {
    if (!enabled || !communityId) {
      setOwnedProductIds(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('product_entitlements')
      .select('product_id')
      .eq('community_id', communityId)
      .is('revoked_at', null)

    if (fetchError) {
      setError(fetchError.message)
      setOwnedProductIds(new Set())
      setLoading(false)
      return
    }

    setOwnedProductIds(
      new Set((data as EntitlementRow[] | null)?.map((row) => row.product_id) ?? []),
    )
    setLoading(false)
  }, [communityId, enabled])

  useEffect(() => {
    fetchEntitlements()
  }, [fetchEntitlements])

  // P3: ao recuperar o foco da janela (ex.: usuário volta da aba da Asaas),
  // recarrega os entitlements. Sem polling — reage apenas ao foco. Não confirma
  // pagamento: se o webhook ainda não concedeu, o produto segue "não adquirido".
  useEffect(() => {
    if (!enabled) return

    function handleFocus() {
      fetchEntitlements()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled, fetchEntitlements])

  return { ownedProductIds, loading, error, refresh: fetchEntitlements }
}
