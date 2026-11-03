// Preparo de imagens antes do upload: recusa formatos que não são de web
// (ex.: .dng/RAW de câmera, que já chegou a 25 MB no bucket) e reduz o resto
// para WebP de até 1600 px, o que corta o tráfego de saída do Supabase.

const MAX_INPUT_BYTES = 15 * 1024 * 1024
const MAX_SIDE = 1600
const WEBP_QUALITY = 0.82
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Use uma imagem JPG, PNG ou WebP.'
  }
  if (file.size > MAX_INPUT_BYTES) {
    return 'A imagem precisa ter no máximo 15 MB.'
  }
  return null
}

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE) {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Devolve um WebP reduzido; se o navegador não conseguir (sem canvas, HEIC
// ilegível, etc.) ou se o resultado não ficar menor, devolve o arquivo original.
export async function compressImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
    const bitmap = await createImageBitmap(file)
    const { width, height } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    )
    if (!blob || blob.size >= file.size) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'imagem'
    return new File([blob], `${base}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
