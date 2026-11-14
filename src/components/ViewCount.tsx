import { useViewTotals, viewKey } from '../hooks/useViewTotals'
import type { ItemViewKind } from '../lib/itemViews'

// Contador mostrado à profissional no próprio item (revista, e-book, logo de
// parceiro): quantas vezes foi aberto e por quantas pessoas.

interface Props {
  communityId: string
  kind: ItemViewKind
  itemId: string
}

export function ViewCount({ communityId, kind, itemId }: Props) {
  const totals = useViewTotals(communityId)
  const row = totals[viewKey(kind, itemId)]
  const views = row?.views ?? 0
  const viewers = row?.viewers ?? 0
  const noun = kind === 'partner_click' ? (views === 1 ? 'clique' : 'cliques') : views === 1 ? 'visualização' : 'visualizações'
  return (
    <span className="view-count" title="Contagem só das participantes (você não entra na conta)">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {views} {noun}
      {views > 0 && ` · ${viewers} ${viewers === 1 ? 'pessoa' : 'pessoas'}`}
    </span>
  )
}
