import { useEffect, useState } from 'react'

// Mede o DESENHO de um logo (a caixa dos pixels que não são fundo), para que
// logos com mais ou menos margem em volta fiquem do mesmo tamanho visual.
// Devolve a proporção do desenho e a fração da altura da imagem que ele ocupa.
// Se o navegador não deixar ler os pixels (imagem de outro site sem permissão),
// devolve null e vale o tamanho de sempre.

export interface LogoContent {
  /** largura / altura do desenho */
  aspect: number
  /** altura do desenho / altura da imagem (0 a 1) */
  ch: number
}

const cache = new Map<string, LogoContent | null>()

export function measureContent(data: Uint8ClampedArray, w: number, h: number): LogoContent | null {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      const nearWhite = data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242
      if (a > 24 && !nearWhite) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const cw = (maxX - minX + 1) / w
  const ch = (maxY - minY + 1) / h
  if (cw < 0.05 || ch < 0.05) return null
  return { aspect: (cw * w) / (ch * h), ch }
}

export function useLogoContent(url: string | null): LogoContent | null {
  const [content, setContent] = useState<LogoContent | null>(url ? (cache.get(url) ?? null) : null)
  useEffect(() => {
    if (!url) return
    if (cache.has(url)) {
      setContent(cache.get(url) ?? null)
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const scale = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem canvas')
        ctx.drawImage(img, 0, 0, w, h)
        const result = measureContent(ctx.getImageData(0, 0, w, h).data, w, h)
        cache.set(url, result)
        if (!cancelled) setContent(result)
      } catch {
        cache.set(url, null)
      }
    }
    img.onerror = () => cache.set(url, null)
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url])
  return content
}
