import { supabase } from './supabase'

// Registro de visualizações (revista, e-book, receita) e de cliques em
// parceiros. Só conta membro: a RLS de `item_views` recusa a dona e a master,
// então os números do painel não incluem a própria profissional.
// "Dispara e esquece": nunca atrasa nem quebra a tela se falhar.

export type ItemViewKind = 'magazine' | 'ebook' | 'recipe' | 'partner_click' | 'screen' | 'travel' | 'series' | 'reading'

const seen = new Set<string>()

/** Conta uma vez por item a cada carregamento do app (evita inflar com reaberturas seguidas). */
export function recordView(communityId: string | null | undefined, kind: ItemViewKind, itemId: string | null | undefined) {
  if (!communityId || !itemId) return
  const key = `${kind}:${itemId}`
  if (kind !== 'partner_click' && seen.has(key)) return
  seen.add(key)
  try {
    void supabase
      .from('item_views')
      .insert({ community_id: communityId, kind, item_id: itemId })
      .then(
        () => undefined,
        () => undefined,
      )
  } catch {
    /* ignora */
  }
}

export interface ItemViewTotal {
  kind: ItemViewKind
  item_id: string
  views: number
  viewers: number
}

/** Totais por item — só a dona da comunidade recebe linhas. */
export async function fetchViewTotals(communityId: string): Promise<ItemViewTotal[]> {
  const { data, error } = await supabase.rpc('item_view_totals', { p_community_id: communityId })
  if (error || !data) return []
  return (data as ItemViewTotal[]).map((r) => ({ ...r, views: Number(r.views), viewers: Number(r.viewers) }))
}
