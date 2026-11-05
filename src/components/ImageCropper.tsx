import { useEffect, useRef, useState } from 'react'

// Recortador simples: a pessoa arrasta para alinhar e usa o zoom; o
// resultado sai do tamanho exato do espaço (sem cortar errado depois).
interface ImageCropperProps {
  file: File
  /** largura / altura do recorte (1 = quadrado/redondo, 3 = banner). */
  aspect: number
  /** largura em pixels do arquivo final. */
  outputWidth: number
  round?: boolean
  title?: string
  onCancel: () => void
  onDone: (file: File) => void
}

export function ImageCropper({
  file,
  aspect,
  outputWidth,
  round = false,
  title = 'Ajustar imagem',
  onCancel,
  onDone,
}: ImageCropperProps) {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // deslocamento em px do frame
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Tamanho exibido da imagem "cobrindo" o frame, antes do zoom.
  function metrics() {
    const box = boxRef.current
    const img = imgRef.current
    if (!box || !img || !img.naturalWidth) return null
    const bw = box.clientWidth
    const bh = box.clientHeight
    const base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight)
    const w = img.naturalWidth * base * zoom
    const h = img.naturalHeight * base * zoom
    return { bw, bh, w, h, base }
  }

  function clamp(x: number, y: number) {
    const m = metrics()
    if (!m) return { x, y }
    const maxX = Math.max(0, (m.w - m.bw) / 2)
    const maxY = Math.max(0, (m.h - m.bh) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  useEffect(() => {
    setPos((p) => clamp(p.x, p.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    setPos(clamp(drag.current.px + e.clientX - drag.current.x, drag.current.py + e.clientY - drag.current.y))
  }
  function onPointerUp() {
    drag.current = null
  }

  async function confirm() {
    const m = metrics()
    const img = imgRef.current
    if (!m || !img) return
    setBusy(true)
    const outW = Math.min(outputWidth, Math.round(img.naturalWidth))
    const outH = Math.round(outW / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setBusy(false)
      return
    }
    // Região visível da imagem original.
    const scale = m.base * zoom
    const sx = (m.w / 2 - m.bw / 2 - pos.x) / scale
    const sy = (m.h / 2 - m.bh / 2 - pos.y) / scale
    ctx.drawImage(img, sx, sy, m.bw / scale, m.bh / scale, 0, 0, outW, outH)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86))
    setBusy(false)
    if (!blob) return
    onDone(new File([blob], 'recorte.webp', { type: 'image/webp' }))
  }

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cropper">
        <h3 className="cropper-title">{title}</h3>
        <p className="cropper-hint">Arraste para alinhar e use o zoom.</p>
        <div
          ref={boxRef}
          className={`cropper-frame${round ? ' cropper-frame--round' : ''}`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const box = boxRef.current
                const img = e.currentTarget
                if (box) {
                  const base = Math.max(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight)
                  setDims({ w: img.naturalWidth * base, h: img.naturalHeight * base })
                }
                setPos({ x: 0, y: 0 })
              }}
              style={{
                width: dims?.w,
                height: dims?.h,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${zoom})`,
              }}
            />
          )}
        </div>
        <label className="cropper-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <div className="cropper-actions">
          <button type="button" className="auth-link" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="profile-save-action" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Salvando...' : 'Usar esta imagem'}
          </button>
        </div>
      </div>
    </div>
  )
}
