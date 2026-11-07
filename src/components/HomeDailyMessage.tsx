import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { attribution, pickInspiration } from '../lib/inspiration'
import type { Inspiration } from '../lib/inspiration'
import { todayParts } from '../lib/weekCalendar'

// Mensagem do dia em destaque no topo da Home. Só mostra o que a
// profissional cadastrou e publicou (nada gerado pelo app). Sem mensagem
// publicada, não aparece. A profissional ganha o atalho "Gerenciar".

interface Props {
  communityId: string | null
  onManage?: () => void
}

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function HomeDailyMessage({ communityId, onManage }: Props) {
  const [item, setItem] = useState<Inspiration | null>(null)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('daily_inspirations')
        .select('id, community_id, kind, body, author, source, status, created_at')
        .eq('community_id', communityId)
        .eq('status', 'published')
      if (!cancelled) setItem(pickInspiration((data ?? []) as Inspiration[], todayIso()))
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  if (!item && !onManage) return null

  return (
    <section className="home-daily" aria-label="Mensagem do dia">
      <span className="home-daily-eyebrow">Mensagem do dia</span>
      {item ? (
        <>
          <p className="home-daily-text">{item.kind === 'citacao' ? `“${item.body}”` : item.body}</p>
          <p className="home-daily-author">{attribution(item)}</p>
        </>
      ) : (
        <p className="home-daily-author">Nenhuma mensagem publicada para hoje.</p>
      )}
      {onManage && (
        <button type="button" className="home-daily-manage" onClick={onManage}>
          Gerenciar mensagens
        </button>
      )}
    </section>
  )
}
