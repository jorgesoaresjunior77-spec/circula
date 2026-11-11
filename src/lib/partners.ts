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
