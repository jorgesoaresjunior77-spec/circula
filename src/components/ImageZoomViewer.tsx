import { useEffect, useRef, useState } from 'react'
import {
  MAG_DOUBLE_TAP_ZOOM,
  MAG_VIEW_RESET,
  clampView,
  clampZoom,
  pointDistance,
  snapView,
  viewForPinch,
} from '../lib/magazineGestures'
import type { MagView } from '../lib/magazineGestures'

// Visualizador de imagem em tela cheia, no tamanho do celular, com zoom de
// pinça (dois dedos), arrasto quando ampliada e toque duplo — a mesma
// experiência do leitor da revista (usa as mesmas contas de magazineGestures).

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

type Pt = { x: number; y: number }

export function ImageZoomViewer({ src, alt = '', onClose }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [view, setView] = useState<MagView>(MAG_VIEW_RESET)
  const viewRef = useRef<MagView>(MAG_VIEW_RESET)
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef({
    pinchDist: 1,
    pinchView: MAG_VIEW_RESET as MagView,
    pinchMid: { x: 0, y: 0 },
    panStart: { x: 0, y: 0 },
    panView: MAG_VIEW_RESET as MagView,
    lastTap: 0,
  })

  function apply(next: MagView) {
    const box = boxRef.current
    const img = imgRef.current
    let v = next
    if (box && img) v = clampView(next, img.clientWidth, img.clientHeight, box.clientWidth, box.clientHeight)
    viewRef.current = v
    setView(v)
  }

  // Esc fecha; o fundo não rola enquanto o visualizador está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  function fromCenter(x: number, y: number): Pt {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return { x, y }
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) }
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      g.pinchDist = Math.max(1, pointDistance(a, b))
      g.pinchView = { ...viewRef.current }
      g.pinchMid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2)
    } else if (pointers.current.size === 1) {
      g.panStart = { x: e.clientX, y: e.clientY }
      g.panView = { ...viewRef.current }
      const now = Date.now()
      if (now - g.lastTap < 300) {
        // Toque duplo: amplia no ponto tocado ou volta ao tamanho normal.
        const start = viewRef.current
        if (start.z > 1.05) apply(MAG_VIEW_RESET)
        else {
          const p = fromCenter(e.clientX, e.clientY)
          apply(viewForPinch(start, p, MAG_DOUBLE_TAP_ZOOM, p))
        }
        g.lastTap = 0
      } else {
        g.lastTap = now
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const ratio = pointDistance(a, b) / g.pinchDist
      const mid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2)
      apply(viewForPinch(g.pinchView, g.pinchMid, clampZoom(g.pinchView.z * ratio), mid))
    } else if (viewRef.current.z > 1) {
      const dx = e.clientX - g.panStart.x
      const dy = e.clientY - g.panStart.y
      apply({ z: g.panView.z, tx: g.panView.tx + dx, ty: g.panView.ty + dy })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (pointers.current.size === 1) {
      // Sobrou um dedo depois da pinça: segue arrastando a partir dele.
      const [p] = [...pointers.current.values()]
      g.panStart = { ...p }
      g.panView = { ...viewRef.current }
    }
    if (pointers.current.size === 0) apply(snapView(viewRef.current))
  }

  return (
    <div className="zoom-viewer" role="dialog" aria-modal="true" aria-label="Imagem ampliada">
      <button type="button" className="zoom-viewer-close" onClick={onClose} aria-label="Fechar imagem">
        ×
      </button>
      <div
        ref={boxRef}
        className="zoom-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})` }}
        />
      </div>
      <p className="zoom-viewer-hint">Use dois dedos para ampliar e reduzir. Toque duas vezes para dar zoom.</p>
    </div>
  )
}
