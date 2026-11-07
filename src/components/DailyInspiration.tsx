import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'
import { supabase } from '../lib/supabase'
import { attribution, displayBody, markSeenToday, pickInspiration, wasSeenToday } from '../lib/inspiration'
import type { Inspiration } from '../lib/inspiration'
import { todayParts } from '../lib/weekCalendar'

// Pop-up de inspiração: na primeira abertura do dia, uma mensagem
// cadastrada pela profissional (citação com fonte, ou texto editorial).
// No máximo uma vez por dia por pessoa neste aparelho. Sem mensagem
// publicada, nada aparece.

interface DailyInspirationProps {
  communityId: string | null
  profileId: string
  /** Outro modal (onboarding, tour, guia de instalação) está aberto: espera. */
  suppressed?: boolean
}

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function DailyInspiration({ communityId, profileId, suppressed = false }: DailyInspirationProps) {
  const today = todayIso()
  const [item, setItem] = useState<Inspiration | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!communityId || wasSeenToday(profileId, today)) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('daily_inspirations')
        .select('id, community_id, kind, body, author, source, status, created_at')
        .eq('community_id', communityId)
        .eq('status', 'published')
      if (cancelled) return
      setItem(pickInspiration((data ?? []) as Inspiration[], today))
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, today])

  const open = !!item && !dismissed && !suppressed

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  function close() {
    markSeenToday(profileId, today)
    setDismissed(true)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open || !item) return null

  return (
    <div className="inspiration-backdrop" onClick={close}>
      <div
        className="inspiration-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Mensagem do dia"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="inspiration-close" onClick={close} aria-label="Fechar">
          <CloseIcon size={18} />
        </button>
        <p className="inspiration-text">{displayBody(item)}</p>
        <p className="inspiration-author">{attribution(item)}</p>
      </div>
    </div>
  )
}
