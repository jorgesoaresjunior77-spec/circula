// Parceiros da comunidade: logos na faixa em movimento da Home.

export interface Partner {
  id: string
  community_id: string
  name: string
  logo_path: string
  link_url: string | null
  position: number
  status: 'draft' | 'published'
}

/**
 * Logos que precisam aparecer um pouco maiores na Home (a arte tem muita
 * margem em volta). Compara pelo nome, sem acento/espaço/maiúscula.
 */
const BOOSTED_PARTNERS = ['speedbox']

export function partnerLogoBoost(name: string | null | undefined): boolean {
  const key = (name ?? '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return BOOSTED_PARTNERS.some((p) => key.includes(p))
}

/**
 * Quantas vezes repetir a lista em cada metade da faixa em movimento, para
 * ela cobrir a tela mesmo com poucos parceiros (pelo menos 6 logos).
 */
export function marqueeRepeats(count: number, minItems = 6): number {
  if (count <= 0) return 0
  return Math.max(1, Math.ceil(minItems / count))
}

/** Só https; qualquer outra coisa vira "sem link". */
export function safePartnerLink(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
