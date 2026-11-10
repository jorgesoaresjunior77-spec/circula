import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { supabase } from '../lib/supabase'
import { attribution, displayBody, markSeenToday, pickInspiration, wasSeenToday } from '../lib/inspiration'
import type { Inspiration } from '../lib/inspiration'
import { todayParts } from '../lib/weekCalendar'

// Mensagem do dia, em dois tempos:
//  1) POPUP — na primeira abertura do dia (por pessoa, neste aparelho), a
//     mensagem aparece grande, no centro da tela;
//  2) LETREIRO — ao fechar o popup (X, toque fora, Esc ou depois de alguns
//     segundos), ela passa a deslizar numa linha só, como painel de aeroporto,
//     logo abaixo da saudação, no topo da Home. Nas outras aberturas do dia,
//     só o letreiro.
// O X do letreiro o esconde pelo resto do dia. A profissional ainda ganha o
// atalho "Gerenciar". Sem mensagem publicada, nada aparece (a profissional vê
// só o atalho).

interface DailyInspirationProps {
  communityId: string | null
  profileId: string
  /** Outro modal (onboarding, tour, guia de instalação) está aberto: espera. */
  suppressed?: boolean
  /** Só para a profissional: abre o cadastro das mensagens do dia. */
  onManage?: () => void
}

/** Quanto tempo o popup fica antes de ir sozinho para o topo. */
const POPUP_MS = 7000
/** Segundos por caractere do letreiro: leitura confortável, constante. */
const TICKER_SECONDS_PER_CHAR = 0.16
const TICKER_MIN_SECONDS = 16

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function DailyInspiration({ communityId, profileId, suppressed = false, onManage }: DailyInspirationProps) {
  const today = todayIso()
  const tickerKey = `${profileId}:bubble`
  const [item, setItem] = useState<Inspiration | null>(null)
  const [popupDone, setPopupDone] = useState(() => wasSeenToday(profileId, today))
  const [tickerHidden, setTickerHidden] = useState(() => wasSeenToday(tickerKey, today))
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const popupRef = useRef<HTMLElement>(null)

  // O letreiro mora dentro da saudação (Home); procura o encaixe a cada render.
  useEffect(() => {
    const el = document.getElementById('daily-ticker-slot')
    if (el !== slot) setSlot(el)
  })

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
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, today])

  const popupOpen = !!item && !popupDone && !suppressed
  const tickerVisible = popupDone && !tickerHidden && !suppressed && !!slot

  const closePopup = useCallback(() => {
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

  function hideTicker() {
    markSeenToday(tickerKey, today)
    setTickerHidden(true)
  }

  if (popupOpen && item) {
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

  if (!tickerVisible || !slot) return null

  const manage = onManage ? (
    <button type="button" className="inspiration-ticker-manage" onClick={onManage}>
      Gerenciar
    </button>
  ) : null

  // Sem mensagem para hoje: só a profissional vê a faixa, com o atalho.
  if (!item) {
    if (!manage || !loaded) return null
    return createPortal(
      <aside className="inspiration-ticker inspiration-ticker--empty" role="note" aria-label="Mensagem do dia">
        <span className="inspiration-ticker-static">Nenhuma mensagem publicada para hoje.</span>
        {manage}
      </aside>,
      slot,
    )
  }

  const line = `${displayBody(item)} — ${attribution(item)}`
  const seconds = Math.max(TICKER_MIN_SECONDS, Math.round(line.length * TICKER_SECONDS_PER_CHAR))

  return createPortal(
    <aside className="inspiration-ticker" role="note" aria-label="Mensagem do dia">
      <div className="inspiration-ticker-viewport">
        <div className="inspiration-ticker-track" style={{ animationDuration: `${seconds}s` }}>
          <span className="inspiration-ticker-item">{line}</span>
          <span className="inspiration-ticker-item" aria-hidden="true">
            {line}
          </span>
        </div>
      </div>
      {manage}
      <button type="button" className="inspiration-ticker-close" onClick={hideTicker} aria-label="Fechar mensagem do dia">
        <CloseIcon size={12} />
      </button>
    </aside>,
    slot,
  )
}
