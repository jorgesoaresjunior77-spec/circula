import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { supabase } from '../lib/supabase'
import { attribution, displayBody, pickInspiration } from '../lib/inspiration'
import type { Inspiration } from '../lib/inspiration'
import { todayParts } from '../lib/weekCalendar'

// Mensagem do dia: aparece em popup, no centro da tela, só quando o app é
// aberto. Fecha no X, tocando fora, com Esc, ou sozinha depois de alguns
// segundos — e depois some (não fica nada na Home). Ao navegar pelo app ela
// não volta; só reaparece quando o app é aberto de novo. Sem mensagem
// publicada, nada aparece.

interface DailyInspirationProps {
  communityId: string | null
  /** Outro modal (onboarding, tour, guia de instalação) está aberto: espera. */
  suppressed?: boolean
}

/** Quanto tempo o popup fica antes de fechar sozinho. */
const POPUP_MS = 7000

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function DailyInspiration({ communityId, suppressed = false }: DailyInspirationProps) {
  const today = todayIso()
  const [item, setItem] = useState<Inspiration | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!communityId) return
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
  }, [communityId, today])

  const open = !!item && !closed && !suppressed
  const close = useCallback(() => setClosed(true), [])

  // Esc e tempo: o popup fecha sozinho.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setTimeout(close, POPUP_MS)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [open, close])

  if (!open || !item) return null

  return createPortal(
    <div className="inspiration-popup-backdrop" onClick={close}>
      <aside
        className="inspiration-popup"
        role="dialog"
        aria-modal="true"
        aria-label="Mensagem do dia"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="inspiration-popup-close" onClick={close} aria-label="Fechar mensagem do dia">
          <CloseIcon size={16} />
        </button>
        <p className="inspiration-popup-eyebrow">Mensagem do dia</p>
        <p className="inspiration-popup-text">{displayBody(item)}</p>
        <p className="inspiration-popup-author">{attribution(item)}</p>
      </aside>
    </div>,
    document.body,
  )
}
