// Obs.: 'carro' (Carro em Dia, R$ 4,50), 'financas' (Finanças, R$ 9,90) e 'rachei' (Rachei $, R$ 4,90) são avulsos e também fazem parte do Premium.
// Desde 2026-11-27 também são avulsos de R$ 4,90 (e incluídos no Premium): Antes de Tudo, Água, IMC, Calculadora, Agenda,
// Relógio do mundo, Previsão do tempo, Diário da Gratidão, Meu Jardim, Na minha cidade e Cotações.
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
  | 'rachei'
  | 'antes_de_tudo'
  | 'agua'
  | 'imc'
  | 'calculadora'
  | 'agenda'
  | 'relogio'
  | 'previsao'
  | 'diario'
  | 'jardim'
  | 'cidade'
  | 'cotacoes'
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
  'rachei',
  'antes_de_tudo',
  'agua',
  'imc',
  'calculadora',
  'agenda',
  'relogio',
  'previsao',
  'diario',
  'jardim',
  'cidade',
  'cotacoes',
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
  rachei: 'Rachei $',
  antes_de_tudo: 'Antes de Tudo',
  agua: 'Água',
  imc: 'IMC',
  calculadora: 'Calculadora',
  agenda: 'Agenda',
  relogio: 'Relógio do mundo',
  previsao: 'Previsão do tempo',
  diario: 'Diário da Gratidão',
  jardim: 'Meu Jardim',
  cidade: 'Na minha cidade',
  cotacoes: 'Cotações',
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
  rachei: 490,
  // ferramentas que eram do plano básico: R$ 4,90 cada (pedido de 2026-11-27)
  antes_de_tudo: 490,
  agua: 490,
  imc: 490,
  calculadora: 490,
  agenda: 490,
  relogio: 490,
  previsao: 490,
  diario: 490,
  jardim: 490,
  cidade: 490,
  cotacoes: 490,
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
    case 'rachei':
      return ['rachei']
    case 'antes_de_tudo':
      return ['antes_de_tudo']
    case 'agua':
      return ['agua']
    case 'imc':
      return ['imc']
    case 'calculadora':
      return ['calculadora']
    case 'agenda':
      return ['agenda']
    case 'relogio':
      return ['relogio']
    case 'previsao':
      return ['previsao']
    case 'diario':
      return ['diario']
    case 'jardim':
      return ['jardim']
    case 'cidade':
      return ['cidade']
    case 'cotacoes':
      return ['cotacoes']
    case 'premium':
      return ['premium']
    default:
      return []
  }
}

// ---- Parcelamento (semestral e anual no cartão) -------------------------------
// O cliente contrata 6 ou 12 meses: é UMA cobrança com o valor total, dividida em parcelas no cartão
// (nunca 6 ou 12 assinaturas mensais). O Asaas divide o total e joga a diferença do arredondamento na
// última parcela. Espelha src/lib/plansCatalog.ts.

/** Máximo de parcelas no cartão: até 6 no semestral e até 12 no anual; o mensal não parcela. */
export function maxInstallments(cycle: AsaasCycle): number {
  return cycle === 'YEARLY' ? 12 : cycle === 'SEMIANNUALLY' ? 6 : 1
}

/** Valor mínimo de cada parcela (R$ 5,00), por segurança com o gateway. */
export const MIN_INSTALLMENT_CENTS = 500

/** Parcelas válidas para este total e ciclo. */
export function isValidInstallments(cycle: AsaasCycle, totalCents: number, n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= maxInstallments(cycle) &&
    (n === 1 || Math.floor(totalCents / n) >= MIN_INSTALLMENT_CENTS)
  )
}

/** Valor de cada parcela em centavos: todas iguais e a última com a sobra do arredondamento. */
export function installmentSplit(totalCents: number, n: number): { each: number; last: number } {
  const each = Math.floor(totalCents / n)
  return { each, last: totalCents - each * (n - 1) }
}

/** Fim da vigência de um contrato pago de uma vez (parcelado): início + 6 ou 12 meses. */
export function fixedPeriodEnd(start: Date, cycle: AsaasCycle): Date {
  return plusCycle(start, cycle)
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

// ---- Plano básico do Círcula (assinatura da comunidade) por ciclo ------------------------------------
// Mensal = o preço da comunidade (piso R$ 14,90). Semestral e anual: no preço de base (R$ 14,90) valem os
// valores cadastrados em billing_plans (R$ 74,90 e R$ 119,90); em outro preço, 16% e 33% de desconto, como
// os avulsos. Espelha src/lib/plansCatalog.ts (communityCyclePrices).
export const COMMUNITY_PLAN_CYCLE: Record<string, AsaasCycle> = {
  member_monthly: 'MONTHLY',
  member_semiannual: 'SEMIANNUALLY',
  member_annual: 'YEARLY',
}

export function communityCyclePriceCents(monthlyCents: number, cycle: AsaasCycle): number {
  if (cycle === 'MONTHLY') return monthlyCents
  if (monthlyCents === 1490) return cycle === 'SEMIANNUALLY' ? 7490 : 11990
  return cycle === 'SEMIANNUALLY' ? roundDime(monthlyCents * 6 * 0.84) : roundDime(monthlyCents * 12 * 0.67)
}
