import type { CommunityContent } from '../types/content'

// C4 / C4.1 — "No Instagram" é uma experiência MANUAL. Não há campo,
// tabela ou flag de "tipo Instagram": a comunidade/profissional cadastra
// a publicação usando o `community_content` que já existe (capa + título
// + legenda + link externo). Um item publicado, com capa, cujo
// `external_url` aponta para o Instagram É, na prática, a publicação
// destacada. Aqui só reconhecemos isso — sem consulta nova, sem hook.

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
])

export function isInstagramUrl(raw: string | null): boolean {
  if (!raw) return false
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Publicações do Instagram destacadas pela comunidade: itens de
 * `community_content` publicados, com capa real, cujo `external_url` é do
 * Instagram. Sem item que se qualifique -> lista vazia -> a experiência
 * "No Instagram" simplesmente não aparece na faixa.
 */
export function filterInstagramContent(items: CommunityContent[]): CommunityContent[] {
  return items.filter(
    (item) =>
      item.status === 'published' &&
      !!item.cover_image_url &&
      isInstagramUrl(item.external_url),
  )
}
