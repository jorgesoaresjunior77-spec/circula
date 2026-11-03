import { beforeEach, describe, expect, it, vi } from 'vitest'

const createSignedUrls = vi.fn()

vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls }) } },
}))

import { clearSignedUrlCache, getSignedUrl, peekSignedUrl } from './signedUrlCache'

function okResponse(paths: string[]) {
  return {
    data: paths.map((path) => ({ path, signedUrl: `https://x/${path}?t=1`, error: null })),
    error: null,
  }
}

describe('signedUrlCache', () => {
  beforeEach(() => {
    clearSignedUrlCache()
    createSignedUrls.mockReset()
  })

  it('junta pedidos simultâneos em uma única chamada ao Storage', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => okResponse(paths))

    const [a, b, c] = await Promise.all([
      getSignedUrl('a.jpg', 3600),
      getSignedUrl('b.jpg', 3600),
      getSignedUrl('c.jpg', 3600),
    ])

    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg', 'c.jpg'], 3600)
    expect([a, b, c]).toEqual(['https://x/a.jpg?t=1', 'https://x/b.jpg?t=1', 'https://x/c.jpg?t=1'])
  })

  it('o mesmo arquivo pedido duas vezes vira um pedido só, e depois sai do cache', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => okResponse(paths))

    await Promise.all([getSignedUrl('a.jpg', 3600), getSignedUrl('a.jpg', 3600)])
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls.mock.calls[0][0]).toEqual(['a.jpg'])

    expect(peekSignedUrl('a.jpg', 3600)).toBe('https://x/a.jpg?t=1')
    await getSignedUrl('a.jpg', 3600)
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
  })

  it('sem permissão ou com erro devolve null e não guarda em cache', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'a.jpg', signedUrl: '', error: 'Object not found' }],
      error: null,
    })
    expect(await getSignedUrl('a.jpg', 3600)).toBeNull()
    expect(peekSignedUrl('a.jpg', 3600)).toBeNull()

    createSignedUrls.mockRejectedValueOnce(new Error('rede'))
    expect(await getSignedUrl('b.jpg', 3600)).toBeNull()
  })

  it('tempos de validade diferentes não se misturam', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => okResponse(paths))
    await Promise.all([getSignedUrl('a.jpg', 3600), getSignedUrl('a.jpg', 60)])
    expect(createSignedUrls).toHaveBeenCalledTimes(2)
  })
})
