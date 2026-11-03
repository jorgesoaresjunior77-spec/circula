import { supabase } from './supabase'

const BUCKET = 'community-media'
// Renova a URL um pouco antes de vencer, para nunca entregar uma expirada.
const SAFETY_MARGIN_MS = 5 * 60 * 1000

interface CacheEntry {
  url: string
  expiresAt: number
}

interface PendingRequest {
  resolve: (url: string | null) => void
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<string | null>>()
const queues = new Map<number, Map<string, PendingRequest[]>>()
let flushScheduled = false

function cacheKey(path: string, expiresIn: number) {
  return `${expiresIn}:${path}`
}

/** URL já assinada e ainda válida, ou null. Síncrona: evita piscar a imagem. */
export function peekSignedUrl(path: string, expiresIn: number): string | null {
  const entry = cache.get(cacheKey(path, expiresIn))
  if (!entry) return null
  if (entry.expiresAt - SAFETY_MARGIN_MS <= Date.now()) {
    cache.delete(cacheKey(path, expiresIn))
    return null
  }
  return entry.url
}

async function flush() {
  flushScheduled = false
  const batches = Array.from(queues.entries())
  queues.clear()

  await Promise.all(
    batches.map(async ([expiresIn, byPath]) => {
      const paths = Array.from(byPath.keys())
      const settle = (path: string, url: string | null) => {
        if (url) cache.set(cacheKey(path, expiresIn), { url, expiresAt: Date.now() + expiresIn * 1000 })
        byPath.get(path)?.forEach((request) => request.resolve(url))
      }

      try {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, expiresIn)
        const urlByPath = new Map<string, string>()
        if (!error) {
          for (const item of data ?? []) {
            if (item.path && item.signedUrl && !item.error) urlByPath.set(item.path, item.signedUrl)
          }
        }
        paths.forEach((path) => settle(path, urlByPath.get(path) ?? null))
      } catch {
        paths.forEach((path) => settle(path, null))
      }
    }),
  )
}

/**
 * Pede a URL assinada de um arquivo do bucket community-media.
 * - Guarda em cache (a mesma imagem em várias telas não pede de novo).
 * - Junta pedidos simultâneos em UMA chamada ao Storage (createSignedUrls),
 *   em vez de uma chamada por imagem.
 * Sem permissão (ou erro) devolve null, como antes.
 */
export function getSignedUrl(path: string, expiresIn: number): Promise<string | null> {
  const cached = peekSignedUrl(path, expiresIn)
  if (cached) return Promise.resolve(cached)

  const key = cacheKey(path, expiresIn)
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = new Promise<string | null>((resolve) => {
    let byPath = queues.get(expiresIn)
    if (!byPath) {
      byPath = new Map()
      queues.set(expiresIn, byPath)
    }
    const requests = byPath.get(path) ?? []
    requests.push({ resolve })
    byPath.set(path, requests)

    if (!flushScheduled) {
      flushScheduled = true
      setTimeout(() => void flush(), 0)
    }
  }).finally(() => {
    inFlight.delete(key)
  })

  inFlight.set(key, promise)
  return promise
}

/** Só para testes. */
export function clearSignedUrlCache() {
  cache.clear()
  inFlight.clear()
  queues.clear()
  flushScheduled = false
}
