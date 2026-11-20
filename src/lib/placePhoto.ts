// Foto real de um lugar (Wikipédia, imagem de capa do verbete da cidade). Nada é
// gerado nem inventado: se o verbete não tem foto, o cartão fica sem imagem.

export interface PlacePhoto {
  url: string
  /** Título do verbete de onde a foto veio (para o crédito). */
  title: string
}

const cache = new Map<string, PlacePhoto | null>()

// Verbetes certos para os lugares fixos (evita a página de desambiguação).
const WIKI_TITLES: Record<string, string> = {
  'brasília': 'Brasília',
  pequim: 'Pequim',
  'nova york': 'Nova_Iorque',
}

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

async function summary(lang: 'pt' | 'en', title: string, fetchImpl: FetchLike): Promise<PlacePhoto | null> {
  const res = await fetchImpl(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
  if (!res.ok) return null
  const body = (await res.json()) as {
    type?: string
    title?: string
    thumbnail?: { source?: string }
    originalimage?: { source?: string }
  }
  if (body.type === 'disambiguation') return null
  const url = body.thumbnail?.source ?? body.originalimage?.source
  return url ? { url: url.replace(/\/\d+px-/, '/960px-'), title: body.title ?? title } : null
}

export async function fetchPlacePhoto(
  name: string,
  country?: string,
  fetchImpl: FetchLike = fetch,
): Promise<PlacePhoto | null> {
  const key = `${name}|${country ?? ''}`.toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null
  let found: PlacePhoto | null = null
  try {
    const known = WIKI_TITLES[name.trim().toLowerCase()]
    found = (known ? await summary('pt', known, fetchImpl) : null) ?? (await summary('pt', name, fetchImpl))
    if (!found && country) found = await summary('pt', `${name} (${country})`, fetchImpl)
    if (!found) found = await summary('en', name, fetchImpl)
  } catch {
    found = null
  }
  cache.set(key, found)
  return found
}
