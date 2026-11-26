// Catálogo da página de Planos. Valores em centavos.
//
// Descontos confirmados pelo usuário em 2026-11-07 (avulsos 16%/33%,
// pacote completo 20%/35%). Em 2026-11-17 entraram os avulsos de Respiração,
// Playlist (R$ 5,80) e Wellness (R$ 4,50) e o "Círcula Premium", que junta
// tudo com desconto (lançamento: R$ 49,90 por mês até 31/12/2026; R$ 59,90 a partir de 01/01/2027 —
// ver PREMIUM_PROMO_ENDS_AT). O mesmo catálogo existe no servidor
// (supabase/functions/_shared/addonPlans.ts): o servidor nunca confia no
// preço que vem do navegador.

export type PlanCycle = 'monthly' | 'semiannual' | 'annual'

export const CYCLE_MONTHS: Record<PlanCycle, number> = { monthly: 1, semiannual: 6, annual: 12 }
export const CYCLE_LABEL: Record<PlanCycle, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
}

export const CIRCULA_MONTHLY_CENTS = 1490
export const PRODUCT_MONTHLY_CENTS = 990

export type ProductKey =
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

export interface CatalogProduct {
  key: ProductKey
  name: string
  description: string
  monthlyCents: number
}

export const PRODUCTS: CatalogProduct[] = [
  { key: 'magazine', name: 'Círcula Magazine', description: 'A revista mensal da comunidade.', monthlyCents: 990 },
  { key: 'receitas', name: 'Receitas', description: 'Receitas em formato de revista.', monthlyCents: 790 },
  { key: 'ebooks', name: 'Loja', description: 'Tudo o que estiver na Loja: e-books e demais produtos digitais, sem pagar um a um.', monthlyCents: 990 },
  { key: 'help_nutri', name: 'Help Nutri', description: 'Chame a nutricionista direto pelo app.', monthlyCents: 990 },
  { key: 'respiracao', name: 'Respiração', description: 'Práticas guiadas de respiração e meditação.', monthlyCents: 590 },
  { key: 'playlist', name: 'Playlist', description: 'As playlists da nutricionista para cada momento.', monthlyCents: 590 },
  { key: 'wellness', name: 'Wellness', description: 'Matérias da nutricionista sobre o mundo do bem-estar.', monthlyCents: 590 },
  { key: 'leitura', name: 'Dicas de Leitura', description: 'As recomendações de livros da nutricionista, por tema.', monthlyCents: 590 },
  {
    key: 'minha_lista',
    name: 'Lista de compras',
    description: 'Organize suas compras, planeje sua alimentação e tenha tudo o que precisa sempre à mão.',
    monthlyCents: 590,
  },
  {
    key: 'meu_chef',
    name: 'Meu Chef',
    description: 'Monte o cardápio do seu encontro com as receitas da nutricionista. Receba bem, sem complicação.',
    monthlyCents: 890,
  },
  {
    key: 'lista_inteligente',
    name: 'Lista de compras inteligente',
    description: 'A lista de compras do seu cardápio, somada e organizada por seção, pronta para salvar em PDF.',
    monthlyCents: 590,
  },
  {
    key: 'exercicios',
    name: 'Se exercite em casa',
    description: 'Treinos montados na hora para fazer em casa, com desenhos passo a passo, só com o peso do corpo e coisas do dia a dia.',
    monthlyCents: 790,
  },
  {
    key: 'series_filmes',
    name: 'Dicas de Séries e Filmes',
    description: 'Curadoria de séries e filmes para a comunidade, com onde assistir. Você assina as plataformas à parte.',
    monthlyCents: 590,
  },
  {
    key: 'viagens',
    name: 'Dicas de Viagem',
    description: 'Roteiros e dicas de destinos, por estado, cidade e para quem viaja: com o que fazer e o que visitar.',
    monthlyCents: 590,
  },
  {
    key: 'carro',
    name: 'Carro em Dia',
    description: 'Perguntas e respostas para cuidar do seu carro, com a Livi e profissionais de confiança da sua cidade.',
    monthlyCents: 450,
  },
  {
    key: 'financas',
    name: 'Finanças',
    description: 'Receitas, gastos e investimentos num só lugar, com lançamento por voz e muito mais.',
    monthlyCents: 990,
  },
  {
    key: 'rachei',
    name: 'Rachei $',
    description: 'A conta do restaurante, do churrasco ou da viagem dividida sem confusão, com cartão bonito para mandar no WhatsApp.',
    monthlyCents: 490,
  },
]

/** Preços editados pelo Master (tabela product_price_overrides): troca o valor mensal em memória. */
export function applyPriceOverrides(rows: { plan_key: string; monthly_cents: number }[]): void {
  for (const r of rows) {
    const p = PRODUCTS.find((x) => x.key === r.plan_key)
    if (p && Number.isFinite(r.monthly_cents) && r.monthly_cents >= 100) p.monthlyCents = r.monthly_cents
  }
}

/** Arredonda para dezenas de centavos (R$ 0,10), como nos preços fechados. */
function roundDime(cents: number): number {
  return Math.round(cents / 10) * 10
}

/** Preços de um produto avulso: semestral com 16% e anual com 33% de economia. */
export function productPrices(monthlyCents: number): Record<PlanCycle, number> {
  return {
    monthly: monthlyCents,
    semiannual: roundDime(monthlyCents * 6 * 0.84),
    annual: roundDime(monthlyCents * 12 * 0.67),
  }
}

/** Preços do avulso de R$ 9,90: semestral e anual com preço fechado. */
export const PRODUCT_PRICES_CENTS: Record<PlanCycle, number> = {
  monthly: 990,
  semiannual: 4980,
  annual: 7970,
}

/** Preços de um produto do catálogo (os de R$ 9,90 usam o preço fechado). */
export function pricesOf(product: CatalogProduct): Record<PlanCycle, number> {
  return product.monthlyCents === PRODUCT_MONTHLY_CENTS
    ? PRODUCT_PRICES_CENTS
    : productPrices(product.monthlyCents)
}

/** Soma dos mensais: Círcula + todos os avulsos (o que daria sem desconto). */
export const PREMIUM_SEPARATE_MONTHLY_CENTS =
  CIRCULA_MONTHLY_CENTS + PRODUCTS.reduce((sum, p) => sum + p.monthlyCents, 0)

/** Círcula Premium: o Círcula e todos os conteúdos juntos, com desconto.
 *  Preço de lançamento: R$ 49,90 por mês para quem assina até 31/12/2026 (horário de Brasília);
 *  a partir de 01/01/2027, R$ 59,90. Semestral 20% e anual 35% de economia sobre o mensal de cada fase.
 *  Espelha supabase/functions/_shared/addonPlans.ts (o servidor é quem cobra). */
export const PREMIUM_PROMO_ENDS_AT = '2027-01-01T00:00:00-03:00'
export const PREMIUM_PROMO_PRICES_CENTS: Record<PlanCycle, number> = { monthly: 4990, semiannual: 23952, annual: 38922 }
export const PREMIUM_REGULAR_PRICES_CENTS: Record<PlanCycle, number> = { monthly: 5990, semiannual: 28752, annual: 46722 }

export function isPremiumPromo(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(PREMIUM_PROMO_ENDS_AT)
}
export function premiumPricesAt(now: Date = new Date()): Record<PlanCycle, number> {
  return isPremiumPromo(now) ? PREMIUM_PROMO_PRICES_CENTS : PREMIUM_REGULAR_PRICES_CENTS
}
/** Preços vigentes hoje. */
export const PREMIUM_PRICES_CENTS: Record<PlanCycle, number> = premiumPricesAt()
export const PREMIUM_MONTHLY_CENTS = PREMIUM_PRICES_CENTS.monthly

/** Desconto extra de quem chega por convite de quem tem o Premium (só no plano Premium). Espelha o servidor. */
export const REFERRAL_DISCOUNT_PERCENT = 10
export function applyReferralDiscount(cents: number): number {
  return roundDime(cents * (1 - REFERRAL_DISCOUNT_PERCENT / 100))
}

/** Parcelamento no cartão (espelha o servidor): até 6x no semestral e 12x no anual; o mensal não parcela.
 *  É uma contratação só, com o valor total dividido; nunca várias assinaturas mensais. */
export function maxInstallments(cycle: PlanCycle): number {
  return cycle === 'annual' ? 12 : cycle === 'semiannual' ? 6 : 1
}
export const MIN_INSTALLMENT_CENTS = 500
/** Opções de parcelas que cabem no total (cada parcela de pelo menos R$ 5,00). */
export function installmentOptions(cycle: PlanCycle, totalCents: number): number[] {
  const out: number[] = []
  for (let n = 1; n <= maxInstallments(cycle); n += 1) {
    if (n === 1 || Math.floor(totalCents / n) >= MIN_INSTALLMENT_CENTS) out.push(n)
  }
  return out
}
/** Valor de cada parcela: iguais, com a sobra do arredondamento na última (como o Asaas faz). */
export function installmentSplit(totalCents: number, n: number): { each: number; last: number } {
  const each = Math.floor(totalCents / n)
  return { each, last: totalCents - each * (n - 1) }
}

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Percentual de economia frente a pagar mês a mês (inteiro, 0 se não há). */
export function savingsPercent(cycle: PlanCycle, priceCents: number, monthlyCents: number): number {
  const full = monthlyCents * CYCLE_MONTHS[cycle]
  if (full <= 0 || priceCents >= full) return 0
  return Math.round((1 - priceCents / full) * 100)
}

export interface CycleBreakdown {
  months: number
  /** Valor sem nenhum desconto: referência mensal × meses. */
  fullCents: number
  /** Total que a pessoa paga no ciclo. */
  totalCents: number
  /** Quanto ela deixa de pagar. */
  savedCents: number
  percent: number
  /** Valor médio por mês no ciclo. */
  perMonthCents: number
}

/** Detalha o ciclo: valor original, total pago, economia em R$ e em %. */
export function cycleBreakdown(cycle: PlanCycle, totalCents: number, referenceMonthlyCents: number): CycleBreakdown {
  const months = CYCLE_MONTHS[cycle]
  const fullCents = referenceMonthlyCents * months
  const savedCents = Math.max(0, fullCents - totalCents)
  return {
    months,
    fullCents,
    totalCents,
    savedCents,
    percent: fullCents > 0 ? Math.round((savedCents / fullCents) * 100) : 0,
    perMonthCents: Math.round(totalCents / months),
  }
}
