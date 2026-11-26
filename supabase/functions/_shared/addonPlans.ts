// Obs.: 'carro' (Carro em Dia, R$ 4,50) e 'financas' (Finanças, R$ 9,90) são avulsos e também fazem parte do Premium.
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
  | 'minha_lista'
  | 'meu_chef'
  | 'lista_inteligente'
  | 'exercicios'
  | 'series_filmes'
  | 'viagens'
  | 'carro'
  | 'financas'
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
  'minha_lista',
  'meu_chef',
  'lista_inteligente',
  'exercicios',
  'series_filmes',
  'viagens',
  'carro',
  'financas',
  'premium',
]

export const ADDON_NAMES: Record<AddonPlanKey, string> = {
  magazine: 'Círcula Magazine',
  receitas: 'Receitas',
  ebooks: 'Loja',
  help_nutri: 'Help Nutri',
  respiracao: 'Respiração',
  playlist: 'Playlist',
  wellness: 'Wellness',
  leitura: 'Dicas de Leitura',
  minha_lista: 'Lista de compras',
  meu_chef: 'Meu Chef',
  lista_inteligente: 'Lista de compras inteligente',
  exercicios: 'Se exercite em casa',
  series_filmes: 'Dicas de Séries e Filmes',
  viagens: 'Dicas de Viagem',
  carro: 'Carro em Dia',
  financas: 'Finanças',
  premium: 'Círcula Premium',
}

const MONTHLY: Record<AddonPlanKey, number> = {
  magazine: 990,
  receitas: 790,
  ebooks: 990,
  help_nutri: 990,
  respiracao: 590,
  playlist: 590,
  wellness: 590,
  leitura: 590,
  minha_lista: 590,
  meu_chef: 890,
  lista_inteligente: 590,
  exercicios: 790,
  series_filmes: 590,
  viagens: 590,
  carro: 450,
  financas: 990,
  premium: 5990,
}

// Círcula Premium: R$ 49,90 por mês para quem assina até 31/12/2026 (horário de Brasília); a partir de 01/01/2027, R$ 59,90.
// Semestral e anual mantêm 20% e 35% de desconto sobre o mensal de cada fase.
export const PREMIUM_PROMO_ENDS_AT = '2027-01-01T00:00:00-03:00'
const PREMIUM_PROMO: Record<AsaasCycle, number> = { MONTHLY: 4990, SEMIANNUALLY: 23952, YEARLY: 38922 } // 4990 × 6 × 0,80 e × 12 × 0,65
const PREMIUM_REGULAR: Record<AsaasCycle, number> = { MONTHLY: 5990, SEMIANNUALLY: 28752, YEARLY: 46722 }

/** Preços do Premium vigentes na data da assinatura. */
export function premiumPricesAt(now: Date = new Date()): Record<AsaasCycle, number> {
  return now.getTime() < Date.parse(PREMIUM_PROMO_ENDS_AT) ? PREMIUM_PROMO : PREMIUM_REGULAR
}
const NINETY_NINETY: Record<AsaasCycle, number> = { MONTHLY: 990, SEMIANNUALLY: 4980, YEARLY: 7970 }

/** Desconto extra da indicação Premium (convidada por quem tem o Premium), só no plano Premium. */
export const REFERRAL_DISCOUNT_PERCENT = 10

export function applyReferralDiscount(cents: number): number {
  return roundDime(cents * (1 - REFERRAL_DISCOUNT_PERCENT / 100))
}

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
/** `overrideMonthly`: valor mensal editado pelo Master (tabela product_price_overrides), se houver. */
export function addonPriceCents(key: AddonPlanKey, cycle: AsaasCycle, overrideMonthly?: number | null, now: Date = new Date()): number {
  if (key === 'premium') return premiumPricesAt(now)[cycle]
  const monthly = overrideMonthly && overrideMonthly >= 100 ? overrideMonthly : MONTHLY[key]
  if (monthly === 990) return NINETY_NINETY[cycle]
  if (cycle === 'MONTHLY') return monthly
  return cycle === 'SEMIANNUALLY' ? roundDime(monthly * 6 * 0.84) : roundDime(monthly * 12 * 0.67)
}

/** Chave da "cesta": vários conteúdos avulsos assinados juntos, numa cobrança só.
 *  Os conteúdos da cesta ficam em addon_subscriptions.bundle_keys. */
export const BUNDLE_PLAN_KEY = 'cesta'

/** Limpa a lista de conteúdos da cesta: só avulsos válidos (nunca o Premium, que é um plano à parte), sem repetir. */
export function sanitizeBundle(keys: unknown): AddonPlanKey[] {
  if (!Array.isArray(keys)) return []
  const out: AddonPlanKey[] = []
  for (const k of keys) {
    if (isAddonPlanKey(k) && k !== 'premium' && !out.includes(k)) out.push(k)
  }
  return out
}

/** Preço da cesta no ciclo: a soma do preço de cada conteúdo naquele ciclo. */
export function bundlePriceCents(keys: AddonPlanKey[], cycle: AsaasCycle, overrides: Partial<Record<AddonPlanKey, number>> = {}): number {
  return keys.reduce((sum, k) => sum + addonPriceCents(k, cycle, overrides[k] ?? null), 0)
}

/** Pacotes que a membro passa a ter quando o plano está ativo
 *  (tabela member_package_access). O Premium libera todos; a cesta libera os conteúdos dela. */
export function packagesForPlan(key: AddonPlanKey | typeof BUNDLE_PLAN_KEY, bundleKeys?: string[] | null): string[] {
  if (key === BUNDLE_PLAN_KEY) return sanitizeBundle(bundleKeys ?? [])
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
    case 'minha_lista':
      return ['minha_lista']
    case 'meu_chef':
      return ['meu_chef']
    case 'lista_inteligente':
      return ['lista_inteligente']
    case 'exercicios':
      return ['exercicios']
    case 'series_filmes':
      return ['series_filmes']
    case 'viagens':
      return ['viagens']
    case 'carro':
      return ['carro']
    case 'financas':
      return ['financas']
    case 'premium':
      return ['premium']
    default:
      return []
  }
}

/** Dias de tolerância depois do fim do período pago antes de retirar o acesso. */
export const ADDON_GRACE_DAYS = 3

function plusCycle(from: Date, cycle: AsaasCycle): Date {
  const months = cycle === 'MONTHLY' ? 1 : cycle === 'SEMIANNUALLY' ? 6 : 12
  const result = new Date(from)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

/**
 * Novo fim do período pago depois de um pagamento confirmado, ou null quando
 * este pagamento já foi contado. Parte do VENCIMENTO da cobrança (não de
 * "agora"), então PAYMENT_CONFIRMED e PAYMENT_RECEIVED da mesma cobrança, que
 * chegam em dias diferentes, não somam dois ciclos. Pagamento muito atrasado
 * recebe um ciclo inteiro a partir de hoje.
 */
export function addonPeriodEnd(
  dueDate: string | undefined,
  cycle: AsaasCycle,
  currentEnd: string | null,
  now: Date = new Date(),
): Date | null {
  const due = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(`${dueDate}T00:00:00Z`) : now
  let target = plusCycle(due, cycle)
  if (target.getTime() <= now.getTime()) target = plusCycle(now, cycle)
  if (currentEnd && new Date(currentEnd).getTime() >= target.getTime()) return null
  return target
}
