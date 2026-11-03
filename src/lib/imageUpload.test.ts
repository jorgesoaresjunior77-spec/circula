import { describe, expect, it } from 'vitest'
import { compressImage, fitWithin, validateImageFile } from './imageUpload'

describe('validateImageFile', () => {
  it('aceita JPG, PNG e WebP dentro do limite', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 3_000_000 })).toBeNull()
    expect(validateImageFile({ type: 'image/png', size: 100 })).toBeNull()
    expect(validateImageFile({ type: 'image/webp', size: 100 })).toBeNull()
  })

  it('recusa RAW/DNG e tipos que não são imagem de web', () => {
    expect(validateImageFile({ type: 'image/x-adobe-dng', size: 100 })).toMatch(/JPG, PNG ou WebP/)
    expect(validateImageFile({ type: '', size: 100 })).toMatch(/JPG, PNG ou WebP/)
    expect(validateImageFile({ type: 'application/pdf', size: 100 })).not.toBeNull()
  })

  it('recusa arquivo acima de 15 MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toMatch(/15 MB/)
  })
})

describe('fitWithin', () => {
  it('não aumenta imagem pequena', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('reduz mantendo a proporção', () => {
    expect(fitWithin(3200, 1600)).toEqual({ width: 1600, height: 800 })
    expect(fitWithin(1200, 4800)).toEqual({ width: 400, height: 1600 })
  })
})

describe('compressImage', () => {
  it('devolve o original quando o navegador não consegue comprimir', async () => {
    const file = new File(['abc'], 'foto.jpg', { type: 'image/jpeg' })
    expect(await compressImage(file)).toBe(file)
  })
})
