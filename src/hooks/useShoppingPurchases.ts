import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PurchaseRow } from '../lib/priceInsights'

// Histórico de compras da Minha Lista (só as compras da própria pessoa: RLS).
// Uma consulta para as compras e uma para todos os itens delas.
export function useShoppingPurchases(enabled: boolean) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void (async () => {
      setLoading(true)
      const { data, error: e } = await supabase
        .from('shopping_purchases')
        .select('id,store_name,purchased_on,total_cents,items_count')
        .order('purchased_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (!alive) return
      if (e) {
        setError('Não foi possível carregar o histórico de compras.')
        setLoading(false)
        return
      }
      const rows = (data ?? []) as Omit<PurchaseRow, 'items'>[]
      const ids = rows.map((r) => r.id)
      const itemsBy = new Map<string, PurchaseRow['items']>()
      if (ids.length) {
        const it = await supabase
          .from('shopping_purchase_items')
          .select('purchase_id,name,brand,category,quantity,unit,paid_price_cents')
          .in('purchase_id', ids)
          .limit(20000)
        if (!alive) return
        for (const r of (it.data ?? []) as (PurchaseRow['items'][number] & { purchase_id: string })[]) {
          const list = itemsBy.get(r.purchase_id) ?? []
          list.push({ ...r, quantity: Number(r.quantity) })
          itemsBy.set(r.purchase_id, list)
        }
      }
      setPurchases(rows.map((r) => ({ ...r, items: itemsBy.get(r.id) ?? [] })))
      setError(null)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [enabled, token])

  const remove = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('shopping_purchases').delete().eq('id', id)
    if (e) return { error: 'Não foi possível excluir agora.' }
    setPurchases((cur) => cur.filter((p) => p.id !== id))
    return { error: null }
  }, [])

  return { purchases, loading, error, reload: () => setToken((n) => n + 1), remove }
}
