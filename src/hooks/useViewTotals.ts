import { useEffect, useState } from 'react'
import { fetchViewTotals } from '../lib/itemViews'
import type { ItemViewKind, ItemViewTotal } from '../lib/itemViews'

// Totais de visualizações/cliques por item, para a profissional. Vários
// componentes na mesma tela (um contador em cada item) dividem UMA consulta:
// o resultado fica guardado por 1 minuto.

type Totals = Record<string, ItemViewTotal>

const TTL_MS = 60_000
const cache = new Map<string, { at: number; promise: Promise<Totals> }>()

export function viewKey(kind: ItemViewKind, itemId: string): string {
  return `${kind}:${itemId}`
}

function load(communityId: string): Promise<Totals> {
  const hit = cache.get(communityId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = fetchViewTotals(communityId).then((rows) => {
    const map: Totals = {}
    for (const r of rows) map[viewKey(r.kind, r.item_id)] = r
    return map
  })
  cache.set(communityId, { at: Date.now(), promise })
  return promise
}

export function useViewTotals(communityId: string | null | undefined, enabled = true): Totals {
  const [totals, setTotals] = useState<Totals>({})

  useEffect(() => {
    if (!communityId || !enabled) return
    let cancelled = false
    void load(communityId).then((map) => {
      if (!cancelled) setTotals(map)
    })
    return () => {
      cancelled = true
    }
  }, [communityId, enabled])

  return totals
}
