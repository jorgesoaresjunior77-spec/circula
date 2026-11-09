import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(false)

  // O balão mora dentro da saudação (Home); procura o encaixe a cada render.
  useEffect(() => {
    const el = document.getElementById('daily-bubble-slot')
    if (el !== slot) setSlot(el)
  })

  useEffect(() => {
    if (!communityId || wasSeenToday(profileId, today)) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('daily_inspirations')
        .select('id, community_id, kind, body, author, source, status, created_at')
        .eq('community_id', communityId)
        .in('status', ['published', 'auto'])
      if (cancelled) return
      setItem(pickInspiration((data ?? []) as Inspiration[], today))
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, today])

  const open = !!item && !dismissed && !suppressed && !!slot

  function close() {
    markSeenToday(profileId, today)
    setDismissed(true)
  }

  if (!open || !item || !slot) return null

  return createPortal(
    <aside className="inspiration-bubble" role="note" aria-label="Mensagem do dia">
      <button ref={closeRef} type="button" className="inspiration-bubble-close" onClick={close} aria-label="Fechar mensagem do dia">
        <CloseIcon size={14} />
      </button>
      <button
        type="button"
        className="inspiration-bubble-body"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={'inspiration-bubble-text' + (expanded ? ' is-open' : '')}>{displayBody(item)}</span>
        <span className="inspiration-bubble-author">{attribution(item)}</span>
      </button>
    </aside>,
    slot,
  )
}
