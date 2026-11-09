import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { supabase } from '../lib/supabase'
import { attribution, displayBody, markSeenToday, pickInspiration, wasSeenToday } from '../lib/inspiration'
import type { Inspiration } from '../lib/inspiration'
import { todayParts } from '../lib/weekCalendar'

// Mensagem do dia, em dois tempos:
//  1) POPUP — na primeira abertura do dia (por pessoa, neste aparelho), a
//     mensagem aparece grande, no centro da tela;
//  2) BALÃO — ao fechar o popup (X, toque fora, Esc ou depois de alguns
//     segundos), ela "voa" para o topo da Home e vira um balão pequeno ao
//     lado do "Bom dia". Nas outras aberturas do dia, só o balão.
// O X do balão o esconde pelo resto do dia. Sem mensagem publicada, nada
// aparece.

interface DailyInspirationProps {
  communityId: string | null
  profileId: string
  /** Outro modal (onboarding, tour, guia de instalação) está aberto: espera. */
  suppressed?: boolean
}

/** Quanto tempo o popup fica antes de ir sozinho para o topo. */
const POPUP_MS = 7000

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function DailyInspiration({ communityId, profileId, suppressed = false }: DailyInspirationProps) {
  const today = todayIso()
  const bubbleKey = `${profileId}:bubble`
  const [item, setItem] = useState<Inspiration | null>(null)
  const [popupDone, setPopupDone] = useState(() => wasSeenToday(profileId, today))
  const [bubbleHidden, setBubbleHidden] = useState(() => wasSeenToday(bubbleKey, today))
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const popupRef = useRef<HTMLElement>(null)
  const bubbleRef = useRef<HTMLElement>(null)
  /** Onde o popup estava quando fechou: o balão parte dali e voa até o topo. */
  const flyFrom = useRef<DOMRect | null>(null)

  // O balão mora dentro da saudação (Home); procura o encaixe a cada render.
  useEffect(() => {
    const el = document.getElementById('daily-bubble-slot')
    if (el !== slot) setSlot(el)
  })

  useEffect(() => {
    if (!communityId || (popupDone && bubbleHidden)) return
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
    // popupDone/bubbleHidden só decidem se vale buscar na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, profileId, today])

  const popupOpen = !!item && !popupDone && !suppressed
  const bubbleVisible = !!item && popupDone && !bubbleHidden && !suppressed && !!slot

  const closePopup = useCallback(() => {
    flyFrom.current = popupRef.current?.getBoundingClientRect() ?? null
    markSeenToday(profileId, today)
    setPopupDone(true)
  }, [profileId, today])

  // Esc e tempo: o popup vai sozinho para o topo.
  useEffect(() => {
    if (!popupOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup()
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setTimeout(closePopup, POPUP_MS)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [popupOpen, closePopup])

  // Voo do popup até o balão: parte do tamanho/posição do popup e desliza até
  // o encaixe ao lado do "Bom dia". Sem movimento (ou sem medida), só aparece.
  useLayoutEffect(() => {
    const from = flyFrom.current
    const el = bubbleRef.current
    if (!bubbleVisible || !from || !el) return
    flyFrom.current = null
    if (prefersReducedMotion()) return
    const to = el.getBoundingClientRect()
    if (to.width === 0 || to.height === 0) return
    el.style.animation = 'none'
    el.style.transition = 'none'
    el.style.transformOrigin = 'top left'
    el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
    // Reflow forçado: fixa o ponto de partida sem depender de quadro de tela
    // (requestAnimationFrame pausa em aba em segundo plano e deixaria o balão
    // preso no lugar do popup).
    void el.offsetWidth
    el.style.transition = 'transform 0.65s cubic-bezier(0.22, 0.8, 0.3, 1)'
    el.style.transform = 'none'
  }, [bubbleVisible])

  function hideBubble() {
    markSeenToday(bubbleKey, today)
    setBubbleHidden(true)
  }

  if (!item) return null

  if (popupOpen) {
    return createPortal(
      <div className="inspiration-popup-backdrop" onClick={closePopup}>
        <aside
          ref={popupRef}
          className="inspiration-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Mensagem do dia"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="inspiration-popup-close" onClick={closePopup} aria-label="Fechar mensagem do dia">
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

  if (!bubbleVisible || !slot) return null

  return createPortal(
    <aside ref={bubbleRef} className="inspiration-bubble" role="note" aria-label="Mensagem do dia">
      <button type="button" className="inspiration-bubble-close" onClick={hideBubble} aria-label="Fechar mensagem do dia">
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
