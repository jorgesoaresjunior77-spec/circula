import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MagazineIssue } from '../types/magazine'
import { MAGAZINE_BLANK_PAGES } from '../types/magazine'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { nextMagazineMessage } from '../lib/magazineSchedule'
import { CloseIcon } from './icons'
import {
  MAG_DOUBLE_TAP_ZOOM,
  MAG_VIEW_RESET,
  castShade,
  clampView,
  dragFraction,
  flapAngle,
  flapShade,
  pointDistance,
  settleMs,
  shouldComplete,
  snapView,
  turnProgress,
  viewForPinch,
} from '../lib/magazineGestures'
import type { MagView, TurnDir } from '../lib/magazineGestures'
import { todayParts } from '../lib/weekCalendar'

function todayIso(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

/** Edição ainda não lançada: a membro vê a capa com "Em breve", sem as páginas. */
export function isUpcoming(issue: MagazineIssue | null, today: string = todayIso()): boolean {
  return !!issue && issue.release_date > today
}

function brDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// "Revista Círcula Magazine": até 6 capas empilhadas (a mais nova na
// frente, cada uma cobrindo ~70% da de trás). Deslizar a de cima para a
// esquerda manda ela para o fim da fila. Clicar abre a revista em tela
// cheia (páginas viradas para a esquerda); de lá há o caminho para o
// Escritório Editorial (a "banca" com as prateleiras).

export const MAGAZINE_STACK_MAX = 6
export const MAGAZINE_SHELF_MAX = 12
export const MAGAZINE_PAGES_MAX = 12
const SHELF_ROW = 4

function Cover({ path, title }: { path: string | null; title: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img loading="lazy" decoding="async" src={url} alt={title} className="mag-cover-img" draggable={false} />
  ) : (
    <span className="mag-cover-blank" aria-hidden="true" />
  )
}

function Page({ path, label }: { path: string | null; label: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img decoding="async" src={url} alt={label} className="mag2-page-img" draggable={false} />
  ) : (
    <span className="mag2-page-blank" role="img" aria-label={`${label} (em branco)`} />
  )
}

interface Turn {
  dir: TurnDir
  from: number
  to: number
}

type GestureMode = 'idle' | 'swipe' | 'pan' | 'pinch' | 'ended'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Leitor em tela cheia. A página acompanha o dedo: arrastar vira a folha (em
// torno da lombada, à esquerda) e, ao soltar, ela termina sozinha o caminho
// com um movimento curto — ou volta, se o arrasto foi pequeno. Dois dedos
// ampliam (pinça), um dedo arrasta a página ampliada e o toque duplo alterna o
// zoom. Setas e botões viram a página com a mesma animação. Com "reduzir
// movimento", a página troca direto, sem animação.
export function MagazineReader({
  issue,
  onClose,
  onOffice,
}: {
  issue: MagazineIssue | null
  onClose: () => void
  onOffice?: () => void
}) {
  const slides: (string | null)[] = issue
    ? [issue.cover_path, ...issue.pages.slice(0, MAGAZINE_PAGES_MAX).map((p) => p.image_path)]
    : []
  const padded =
    slides.length > 1 ? slides : [slides[0] ?? null, ...Array(MAGAZINE_BLANK_PAGES).fill(null)]
  const total = padded.length
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(true)
  const [zoomed, setZoomed] = useState(false)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [downloadError, setDownloadError] = useState(false)
  const { url: currentUrl } = useSignedImageUrl(padded[index])

  const indexRef = useRef(0)
  const turnRef = useRef<Turn | null>(null)
  const progressRef = useRef(0)
  const pendingRef = useRef<{ target: number; ms: number; completed: boolean } | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const pageRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const flapRef = useRef<HTMLDivElement>(null)
  const flapShadeRef = useRef<HTMLSpanElement>(null)
  const castRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MagView>(MAG_VIEW_RESET)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const gesture = useRef({
    mode: 'idle' as GestureMode,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    dir: 'next' as TurnDir,
    pinchDist: 1,
    pinchView: MAG_VIEW_RESET as MagView,
    pinchMid: { x: 0, y: 0 },
  })

  // ---- enquadramento (zoom e arrasto) --------------------------------------
  const applyView = useCallback((view: MagView) => {
    viewRef.current = view
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transform =
        view.z === 1 && view.tx === 0 && view.ty === 0
          ? ''
          : `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.z})`
    }
    setZoomed(view.z > 1.001)
  }, [])

  const boundedView = useCallback((view: MagView): MagView => {
    const page = pageRef.current
    const sheet = sheetRef.current
    if (!page || !sheet) return view
    return clampView(view, sheet.offsetWidth, sheet.offsetHeight, page.clientWidth, page.clientHeight)
  }, [])

  /** Ponto da tela relativo ao centro da área da página. */
  const fromCenter = useCallback((x: number, y: number) => {
    const rect = pageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: x - (rect.left + rect.width / 2), y: y - (rect.top + rect.height / 2) }
  }, [])

  // ---- folha que vira ------------------------------------------------------
  const applyProgress = useCallback((p: number, ms = 0) => {
    progressRef.current = p
    const flap = flapRef.current
    if (!flap) return
    const ease = 'cubic-bezier(0.3, 0.7, 0.25, 1)'
    flap.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none'
    flap.style.transform = `rotateY(${flapAngle(p)}deg)`
    const shade = flapShadeRef.current
    if (shade) {
      shade.style.transition = ms ? `opacity ${ms}ms ease-out` : 'none'
      shade.style.opacity = String(flapShade(p))
    }
    const cast = castRef.current
    if (cast && !ms) cast.style.opacity = String(castShade(p))
  }, [])

  const finishTurn = useCallback(
    (completed: boolean) => {
      const t = turnRef.current
      if (!t) return
      window.clearTimeout(settleTimer.current)
      pendingRef.current = null
      if (completed) {
        indexRef.current = t.to
        setIndex(t.to)
        applyView(MAG_VIEW_RESET)
      }
      turnRef.current = null
      setTurn(null)
    },
    [applyView],
  )

  const runSettle = useCallback(() => {
    const pending = pendingRef.current
    const flap = flapRef.current
    if (!pending || !flap) return
    pendingRef.current = null
    void flap.offsetWidth // fixa o ponto de partida antes de animar
    applyProgress(pending.target, pending.ms)
    const cast = castRef.current
    if (cast) cast.style.animation = `mag2-cast ${pending.ms}ms ease-in-out both`
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => finishTurn(pending.completed), pending.ms + 40)
  }, [applyProgress, finishTurn])

  /** Termina a virada a partir de onde a folha está (ou do começo). */
  const settle = useCallback(
    (target: number, completed: boolean) => {
      pendingRef.current = { target, ms: settleMs(progressRef.current, target), completed }
      runSettle()
    },
    [runSettle],
  )

  const beginTurn = useCallback((dir: TurnDir): boolean => {
    const from = indexRef.current
    const to = dir === 'next' ? from + 1 : from - 1
    if (turnRef.current || to < 0 || to > total - 1) return false
    const t = { dir, from, to }
    turnRef.current = t
    progressRef.current = turnProgress(dir, 0)
    setTurn(t)
    return true
  }, [total])

  // Depois de desenhar a folha: aplica o ponto de partida e, se houver, anima.
  useLayoutEffect(() => {
    if (!turn) return
    applyProgress(progressRef.current)
    runSettle()
  }, [turn, applyProgress, runSettle])

  /** Vira a página por botão, seta ou toque: mesma animação, sem arrasto. */
  const goTo = useCallback(
    (to: number) => {
      const from = indexRef.current
      if (to === from || to < 0 || to > total - 1 || turnRef.current) return
      setHint(false)
      if (viewRef.current.z > 1) applyView(MAG_VIEW_RESET)
      if (prefersReducedMotion()) {
        indexRef.current = to
        setIndex(to)
        return
      }
      const dir: TurnDir = to > from ? 'next' : 'prev'
      if (!beginTurn(dir)) return
      indexRef.current = to
      setIndex(to)
      settle(dir === 'next' ? 1 : 0, true)
    },
    [total, applyView, beginTurn, settle],
  )
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo])
  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  // ---- gestos --------------------------------------------------------------
  function toggleDoubleTapZoom(x: number, y: number) {
    if (viewRef.current.z > 1.001) {
      applyView(MAG_VIEW_RESET)
      return
    }
    const m = fromCenter(x, y)
    applyView(boundedView(viewForPinch(MAG_VIEW_RESET, m, MAG_DOUBLE_TAP_ZOOM, m)))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Alguns navegadores recusam a captura; o arrasto segue pelos eventos normais.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size === 1) {
      g.mode = 'idle'
      g.startX = g.lastX = e.clientX
      g.startY = g.lastY = e.clientY
      g.lastT = e.timeStamp
      g.vx = 0
    } else if (pointers.current.size === 2) {
      // Segundo dedo: vira pinça. Uma virada começada volta para o lugar.
      if (g.mode === 'swipe') settle(turnProgress(g.dir, 0), false)
      const [a, b] = [...pointers.current.values()]
      g.mode = 'pinch'
      g.pinchDist = Math.max(1, pointDistance(a, b))
      g.pinchView = { ...viewRef.current }
      g.pinchMid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current

    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const mid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2)
      const z = g.pinchView.z * (pointDistance(a, b) / g.pinchDist)
      applyView(boundedView(viewForPinch(g.pinchView, g.pinchMid, z, mid)))
      setHint(false)
      return
    }
    if (pointers.current.size !== 1) return

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY

    if (g.mode === 'idle' && Math.hypot(dx, dy) > 8) {
      if (viewRef.current.z > 1.001) {
        g.mode = 'pan'
      } else if (Math.abs(dx) > Math.abs(dy)) {
        const dir: TurnDir = dx < 0 ? 'next' : 'prev'
        if (!prefersReducedMotion() && beginTurn(dir)) {
          g.mode = 'swipe'
          g.dir = dir
          setHint(false)
        } else {
          g.mode = 'ended'
        }
      } else {
        g.mode = 'ended'
      }
    }

    if (g.mode === 'swipe') {
      const width = sheetRef.current?.offsetWidth ?? 300
      applyProgress(turnProgress(g.dir, dragFraction(g.dir, dx, width)))
      const dt = e.timeStamp - g.lastT
      if (dt > 0) g.vx = 0.6 * g.vx + 0.4 * ((e.clientX - g.lastX) / dt)
    } else if (g.mode === 'pan') {
      const v = viewRef.current
      applyView(boundedView({ z: v.z, tx: v.tx + (e.clientX - g.lastX), ty: v.ty + (e.clientY - g.lastY) }))
    }
    g.lastX = e.clientX
    g.lastY = e.clientY
    g.lastT = e.timeStamp
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    const cancelled = e.type === 'pointercancel'

    if (g.mode === 'swipe') {
      const frac = g.dir === 'next' ? progressRef.current : 1 - progressRef.current
      const toward = g.dir === 'next' ? -g.vx : g.vx
      const complete = !cancelled && shouldComplete(frac, toward)
      settle(complete ? turnProgress(g.dir, 1) : turnProgress(g.dir, 0), complete)
      g.mode = 'ended'
      return
    }

    if (g.mode === 'pinch') {
      applyView(boundedView(snapView(viewRef.current)))
      const rest = [...pointers.current.values()][0]
      if (rest) {
        g.mode = viewRef.current.z > 1.001 ? 'pan' : 'ended'
        g.startX = g.lastX = rest.x
        g.startY = g.lastY = rest.y
      } else {
        g.mode = 'ended'
      }
      return
    }

    if (g.mode === 'idle' && !cancelled && pointers.current.size === 0) {
      // Toque (sem arrastar): dois toques seguidos alternam o zoom.
      const now = e.timeStamp
      const prevTap = lastTap.current
      if (prevTap && now - prevTap.t < 320 && Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 28) {
        lastTap.current = null
        toggleDoubleTapZoom(e.clientX, e.clientY)
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY }
      }
    }
    if (pointers.current.size === 0) g.mode = 'idle'
  }

  // Pinça no trackpad / ctrl + roda do mouse (computador).
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()
      const v = viewRef.current
      const m = fromCenter(e.clientX, e.clientY)
      applyView(boundedView(snapView(viewForPinch(v, m, v.z * Math.exp(-e.deltaY * 0.01), m))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyView, boundedView, fromCenter])

  async function handleDownload() {
    if (!currentUrl) return
    setDownloadError(false)
    try {
      const res = await fetch(currentUrl)
      if (!res.ok) throw new Error('download')
      const blob = await res.blob()
      const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'webp'
      const base = (issue?.title ?? 'revista').replace(/[^\w-]+/g, '-')
      const part = index === 0 ? 'capa' : 'pagina-' + index
      const a = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      a.href = objectUrl
      a.download = base + '-' + part + '.' + ext
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
    } catch {
      setDownloadError(true)
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 4500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, next, prev])

  const title = issue?.title ?? 'Revista Círcula Magazine'
  const label = (i: number) => (i === 0 ? 'Capa' : `Página ${i}`)
  // Avançando, a página de baixo já é a próxima e a folha é a atual; voltando,
  // a folha é a anterior e cai sobre a atual.
  const baseIdx = turn ? (turn.dir === 'next' ? turn.to : turn.from) : index
  const flapIdx = turn ? (turn.dir === 'next' ? turn.from : turn.to) : null

  return (
    <div className="mag2-reader" role="dialog" aria-modal="true" aria-label={`Revista ${title}`}>
      <button type="button" className="mag2-close" onClick={onClose} aria-label="Fechar revista" data-autofocus>
        <CloseIcon />
      </button>
      <p className="mag2-count">
        {title} · {index + 1}/{total}
      </p>
      <div
        ref={pageRef}
        className={'mag2-page' + (zoomed ? ' mag2-page--zoomed' : '')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div ref={sheetRef} className="mag2-sheet">
          <Page path={padded[baseIdx]} label={label(baseIdx)} />
          {turn && flapIdx !== null && (
            <>
              <div ref={castRef} className="mag2-cast" aria-hidden="true" />
              <div ref={flapRef} className="mag2-flap" aria-hidden="true">
                <Page path={padded[flapIdx]} label="" />
                <span ref={flapShadeRef} className="mag2-flap-shade" />
              </div>
            </>
          )}
        </div>
      </div>
      {hint && <p className="mag2-hint">Deslize para virar a página · dois dedos para ampliar</p>}
      {downloadError && (
        <p className="mag2-error" role="alert">
          Não foi possível baixar agora. Tente novamente.
        </p>
      )}
      <div className="mag2-tools">
        <button type="button" className="mag2-download" onClick={() => void handleDownload()} disabled={!currentUrl} aria-label="Baixar esta página">
          Baixar
        </button>
      </div>
      <div className="mag2-controls">
        <button type="button" onClick={prev} disabled={index === 0} aria-label="Página anterior">
          ‹
        </button>
        {onOffice && (
          <button type="button" className="mag2-office" onClick={onOffice}>
            Entrar no Escritório Editorial
          </button>
        )}
        <button type="button" onClick={next} disabled={index === total - 1} aria-label="Próxima página">
          ›
        </button>
      </div>
    </div>
  )
}

function ShelfCover({ issue, onOpen }: { issue: MagazineIssue; onOpen: () => void }) {
  return (
    <button type="button" className="mag-shelf-cover" onClick={onOpen} aria-label={`Ler ${issue.title}`}>
      <Cover path={issue.cover_path} title={issue.title} />
    </button>
  )
}

function EditorialOffice({
  image,
  issues,
  manager,
  onRead,
  onClose,
}: {
  image: string | null
  issues: MagazineIssue[]
  /** Cadastro das edições — só a profissional recebe. */
  manager?: ReactNode
  onRead: (issue: MagazineIssue) => void
  onClose: () => void
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const shelved = issues.slice(0, MAGAZINE_SHELF_MAX)
  const rows: MagazineIssue[][] = []
  for (let i = 0; i < shelved.length; i += SHELF_ROW) rows.push(shelved.slice(i, i + SHELF_ROW))
  // Sempre mostra as prateleiras (vazias enquanto não há edição).
  while (rows.length < 3) rows.push([])

  return (
    <div
      className="mag-office"
      role="dialog"
      aria-modal="true"
      aria-label="Escritório Editorial"
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
    >
      <div className="mag-office-veil">
        <button type="button" className="mag2-close" onClick={onClose} aria-label="Fechar" data-autofocus>
          <CloseIcon />
        </button>
        <h3 className="mag-office-title">Revista Círcula Magazine</h3>
        <p className="mag-office-text">Bem-vinda ao Escritório Editorial da Círcula Magazine.</p>
        <p className="mag-office-text">{nextMagazineMessage()}</p>

        <div className="mag-newsstand">
          {rows.map((row, r) => (
            <div className="mag-shelf" key={r}>
              <div className="mag-shelf-row">
                {Array.from({ length: SHELF_ROW }, (_, c) => {
                  const issue = row[c]
                  return issue ? (
                    <ShelfCover key={issue.id} issue={issue} onOpen={() => onRead(issue)} />
                  ) : (
                    <span key={c} className="mag-shelf-cover mag-shelf-cover--empty" aria-hidden="true" />
                  )
                })}
              </div>
              <div className="mag-shelf-board" />
            </div>
          ))}
        </div>

        {manager && <div className="mag-office-manager">{manager}</div>}

        <button type="button" className="mag-office-btn" onClick={onClose}>
          Voltar
        </button>
      </div>
    </div>
  )
}

function Stack({
  issues,
  onOpen,
  hideBadges = false,
}: {
  issues: (MagazineIssue | null)[]
  onOpen: (issue: MagazineIssue | null) => void
  /** A profissional vê tudo sem selo. */
  hideBadges?: boolean
}) {
  // Ordem de exibição (frente primeiro). Muda só quando a lista muda.
  const key = issues.map((i) => i?.id ?? '-').join(',')
  const [order, setOrder] = useState<number[]>(() => issues.map((_, i) => i))
  useEffect(() => {
    setOrder(issues.map((_, i) => i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const drag = useRef<{ x: number; moved: boolean } | null>(null)
  const justSwiped = useRef(false)

  function sendFrontToBack() {
    setOrder((o) => (o.length > 1 ? [...o.slice(1), o[0]] : o))
  }

  const n = issues.length
  return (
    <ul className="mag2-stack" style={{ ['--mag-n' as string]: n }}>
      {issues.map((issue, idx) => {
        const pos = order.indexOf(idx)
        const isFront = pos === 0
        return (
          <li
            key={issue?.id ?? `blank-${idx}`}
            className="mag2-stack-item"
            style={{ ['--mag-pos' as string]: pos, zIndex: n - pos }}
          >
            <button
              type="button"
              className="mag-cover"
              aria-label={issue ? `Ler a revista ${issue.title}` : 'Revista em breve'}
              onPointerDown={(e) => {
                if (!isFront) return
                drag.current = { x: e.clientX, moved: false }
              }}
              onPointerUp={(e) => {
                const d = drag.current
                drag.current = null
                if (!d || !isFront) return
                if (e.clientX - d.x < -40) {
                  justSwiped.current = true
                  sendFrontToBack()
                }
              }}
              onClick={() => {
                if (justSwiped.current) {
                  justSwiped.current = false
                  return
                }
                onOpen(issue)
              }}
            >
              <Cover path={issue?.cover_path ?? null} title={issue?.title ?? ''} />
              {!hideBadges && isUpcoming(issue) && issue && (
                <span className="mag-soon-badge">Em breve · {brDate(issue.release_date)}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface HomeMagazineStripProps {
  issues: MagazineIssue[]
  /** Fundo (já assinado) do Escritório Editorial. */
  officeImage: string | null
  /** Cadastro das edições dentro do escritório (só a profissional). */
  manager?: ReactNode
}

export function HomeMagazineStrip({ issues, officeImage, manager }: HomeMagazineStripProps) {
  // `reading`: undefined = fechado; null = leitor de edição em branco.
  const [reading, setReading] = useState<MagazineIssue | null | undefined>(undefined)
  const [office, setOffice] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const isOwner = !!manager

  function handleOpen(issue: MagazineIssue | null) {
    if (!isOwner && isUpcoming(issue) && issue) {
      setNotice(`A edição ${issue.title} será liberada em ${brDate(issue.release_date)}.`)
      return
    }
    setNotice(null)
    setReading(issue)
  }

  // Sempre uma pilha cheia: as edições reais na frente (a mais nova primeiro)
  // e, atrás, exemplares mais antigos ainda sem capa.
  const real = issues.slice(0, MAGAZINE_STACK_MAX)
  const stacked: (MagazineIssue | null)[] = [
    ...real,
    ...Array.from({ length: MAGAZINE_STACK_MAX - real.length }, () => null),
  ]

  return (
    <section className="mag-strip" aria-labelledby="mag-strip-title">
      <h2 id="mag-strip-title" className="circ-strip-title">
        Revista Círcula Magazine
      </h2>

      <m.div className="mag2-viewport" {...inViewOnce} variants={riseVariants}>
        <Stack issues={stacked} onOpen={handleOpen} hideBadges={isOwner} />
      </m.div>
      {notice && (
        <p className="mag-soon-notice" role="status">
          {notice}
        </p>
      )}

      {reading !== undefined && (
        <MagazineReader
          issue={reading}
          onClose={() => setReading(undefined)}
          onOffice={() => {
            setReading(undefined)
            setOffice(true)
          }}
        />
      )}
      {office && (
        <EditorialOffice
          image={officeImage}
          issues={issues}
          manager={manager}
          onRead={(issue) => setReading(issue)}
          onClose={() => setOffice(false)}
        />
      )}
    </section>
  )
}
