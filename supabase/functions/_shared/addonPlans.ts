// Catálogo das assinaturas avulsas (revista, receitas, e-books, Help Nutri,
// respiração, playlist, wellness) e do Círcula Premium. Valores em centavos.
// ESPELHA src/lib/plansCatalog.ts: o servidor só confia neste arquivo, nunca
// no preço que vem do navegador. Se mudar um, mude o outro.

export type AddonPlanKey =
  | 'magazine'
  | 'receitas'
  | 'ebooks'
  | 'help_nutri'
  | 'respiracao'
  | 'playlist'
  | 'wellness'
  | 'leitura'
  | 'premium'

export type AsaasCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'

export const ADDON_PLAN_KEYS: AddonPlanKey[] = [
  'magazine',
  'receitas',
  'ebooks',
  'help_nutri',
  'respiracao',
  'playlist',
  'wellness',
  'leitura',
  'premium',
]

export const ADDON_NAMES: Record<AddonPlanKey, string> = {
  magazine: 'Círcula Magazine',
  receitas: 'Receitas',
  ebooks: 'E-books',
  help_nutri: 'Help Nutri',
  respiracao: 'Respiração',
  playlist: 'Playlist',
  wellness: 'Wellness',
  leitura: 'Dicas de Leitura',
  premium: 'Círcula Premium',
}

const MONTHLY: Record<AddonPlanKey, number> = {
  magazine: 990,
  receitas: 990,
  ebooks: 990,
  help_nutri: 990,
  respiracao: 580,
  playlist: 580,
  wellness: 450,
  leitura: 450,
  premium: 5990,
}

// Preços fechados que já existiam no catálogo do app.
const CLOSED: Partial<Record<AddonPlanKey, Record<AsaasCycle, number>>> = {
  premium: { MONTHLY: 5990, SEMIANNUALLY: 28752, YEARLY: 46722 },
}
const NINETY_NINETY: Record<AsaasCycle, number> = { MONTHLY: 990, SEMIANNUALLY: 4980, YEARLY: 7970 }

function roundDime(cents: number): number {
  return Math.round(cents / 10) * 10
}

export function isAddonPlanKey(v: unknown): v is AddonPlanKey {
  return typeof v === 'string' && (ADDON_PLAN_KEYS as string[]).includes(v)
}

export function isAsaasCycle(v: unknown): v is AsaasCycle {
  return v === 'MONTHLY' || v === 'SEMIANNUALLY' || v === 'YEARLY'
}

/** Preço em centavos do plano no ciclo pedido. */
export function addonPriceCents(key: AddonPlanKey, cycle: AsaasCycle): number {
  const closed = CLOSED[key]
  if (closed) return closed[cycle]
  const monthly = MONTHLY[key]
  if (monthly === 990) return NINETY_NINETY[cycle]
  if (cycle === 'MONTHLY') return monthly
  return cycle === 'SEMIANNUALLY' ? roundDime(monthly * 6 * 0.84) : roundDime(monthly * 12 * 0.67)
}

/** Pacotes que a membro passa a ter quando o plano está ativo
 *  (tabela member_package_access). O Premium libera todos. */
export function packagesForPlan(key: AddonPlanKey): string[] {
  switch (key) {
    case 'magazine':
      return ['magazine']
    case 'receitas':
      return ['receitas']
    case 'help_nutri':
      return ['help_nutri']
    case 'ebooks':
      return ['ebooks']
    case 'respiracao':
      return ['respiracao']
    case 'playlist':
      return ['playlist']
    case 'wellness':
      return ['wellness']
    case 'leitura':
      return ['leitura']
    case 'premium':
      return ['premium']
    default:
      return []
  }
}
