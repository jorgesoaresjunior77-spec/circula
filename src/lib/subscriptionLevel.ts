// Nível da assinatura da membro e os produtos que ela tem, a partir dos
// pacotes liberados (member_package_access) e do estado da assinatura da
// comunidade. O Premium vale por todos os produtos; o plano completo, pelo
// Help Nutri e pelos E-books.

import { PRODUCTS } from './plansCatalog'

export type SubscriptionLevelId = 'premium' | 'circula' | 'none'

export interface SubscriptionLevel {
  id: SubscriptionLevelId
  label: string
  hint: string
}

const LIVE_STATES = new Set(['active', 'renewing_soon', 'trial', 'trial_ending', 'past_due'])

export function isCommunityPlanLive(state: string | null | undefined): boolean {
  return !!state && LIVE_STATES.has(state)
}

/** Nomes dos produtos que a membro tem, na ordem do catálogo. */
export function ownedProductNames(packages: ReadonlySet<string> | readonly string[]): string[] {
  const has = (k: string) => (Array.isArray(packages) ? packages.includes(k) : (packages as ReadonlySet<string>).has(k))
  if (has('premium')) return PRODUCTS.map((p) => p.name)
  return PRODUCTS.filter((p) => {
    if (has(p.key)) return true
    if (has('total') && (p.key === 'help_nutri' || p.key === 'ebooks')) return true
    return false
  }).map((p) => p.name)
}

export function subscriptionLevel(
  packages: ReadonlySet<string> | readonly string[],
  communityState: string | null | undefined,
): SubscriptionLevel {
  const has = (k: string) => (Array.isArray(packages) ? packages.includes(k) : (packages as ReadonlySet<string>).has(k))
  if (has('premium')) {
    return { id: 'premium', label: 'Círcula Premium', hint: 'Todos os conteúdos liberados.' }
  }
  if (isCommunityPlanLive(communityState)) {
    return { id: 'circula', label: 'Círcula', hint: 'Comunidade ativa, mais os conteúdos que você contratou.' }
  }
  return { id: 'none', label: 'Sem plano ativo', hint: 'Assine para liberar o Círcula e os conteúdos.' }
}
