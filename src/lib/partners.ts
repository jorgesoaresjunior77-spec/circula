// Parceiros da comunidade: logos na faixa em movimento da Home.

export interface Partner {
  id: string
  community_id: string
  name: string
  logo_path: string
  link_url: string | null
  position: number
  status: 'draft' | 'published'
  /** Página do parceiro (todos opcionais). */
  cover_path?: string | null
  description?: string | null
  category?: string | null
  city?: string | null
  /** Só o @ (sem o @), ex.: benleve.oficial */
  instagram?: string | null
  city_listing_id?: string | null
}

/** Aceita "@perfil", "perfil" ou o link do Instagram; devolve só o usuário (ou null se não serve). */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i)
  const user = (m ? m[1] : t.replace(/^@/, '')).replace(/\/+$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(user) ? user : null
}

export function instagramUrl(user: string | null | undefined): string | null {
  const u = normalizeInstagram(user)
  return u ? `https://www.instagram.com/${encodeURIComponent(u)}/` : null
}

export interface PartnerCoupon {
  id: string
  title: string
  code: string
  benefit: string
  discount_type: 'percentual' | 'valor' | 'frete_gratis' | 'brinde' | 'outro'
  discount_value: number | null
  instructions: string | null
  valid_from: string | null
  valid_until: string | null
  max_per_person: number | null
  after_redeem: 'hide' | 'mark'
  used: number
  available: boolean
  status: 'disponivel' | 'esgotado' | 'expirado' | 'em_breve'
}

/** Código de cupom: maiúsculas, números, - e _ (3 a 30). */
export function normalizeCouponCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
}

export function couponValueLabel(c: Pick<PartnerCoupon, 'discount_type' | 'discount_value'>): string | null {
  if (c.discount_type === 'percentual' && c.discount_value) return `${String(c.discount_value).replace('.', ',')}% OFF`
  if (c.discount_type === 'valor' && c.discount_value) return `R$ ${Number(c.discount_value).toFixed(2).replace('.', ',')} OFF`
  if (c.discount_type === 'frete_gratis') return 'Frete grátis'
  if (c.discount_type === 'brinde') return 'Brinde'
  return null
}

/**
 * Logos que precisam aparecer um pouco maiores na Home (a arte tem muita
 * margem em volta). Compara pelo nome, sem acento/espaço/maiúscula.
 */
const BOOSTED_PARTNERS = ['speedbox']

/** Logos que pedem um tamanho próprio (multiplicador sobre o padrão). */
const SCALED_PARTNERS: Record<string, number> = { benleve: 1.1 }

export function partnerLogoScale(name: string | null | undefined): number {
  const key = (name ?? '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  const hit = Object.keys(SCALED_PARTNERS).find((p) => key.includes(p))
  return hit ? SCALED_PARTNERS[hit] : 1
}

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
