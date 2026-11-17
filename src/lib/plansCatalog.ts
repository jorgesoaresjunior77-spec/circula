// Catálogo da página de Planos. Valores em centavos.
//
// Descontos confirmados pelo usuário em 2026-11-07 (avulsos 16%/33%,
// pacote completo 20%/35%). Em 2026-11-17 entraram os avulsos de Respiração,
// Playlist (R$ 5,80) e Wellness (R$ 4,50) e o "Círcula Premium", que junta
// tudo com desconto (R$ 59,90 por mês, valor confirmado pelo usuário). O mesmo catálogo existe no servidor
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

export interface CatalogProduct {
  key: ProductKey
  name: string
  description: string
  monthlyCents: number
}

export const PRODUCTS: CatalogProduct[] = [
  { key: 'magazine', name: 'Círcula Magazine', description: 'A revista mensal da comunidade.', monthlyCents: 990 },
  { key: 'receitas', name: 'Receitas', description: 'Receitas em formato de revista.', monthlyCents: 990 },
  { key: 'ebooks', name: 'E-books', description: 'Os e-books da nutricionista.', monthlyCents: 990 },
  { key: 'help_nutri', name: 'Help Nutri', description: 'Chame a nutricionista direto pelo app.', monthlyCents: 990 },
  { key: 'respiracao', name: 'Respiração', description: 'Práticas guiadas de respiração e meditação.', monthlyCents: 580 },
  { key: 'playlist', name: 'Playlist', description: 'As playlists da nutricionista para cada momento.', monthlyCents: 580 },
  { key: 'wellness', name: 'Wellness', description: 'Matérias da nutricionista sobre o mundo do bem-estar.', monthlyCents: 450 },
  { key: 'leitura', name: 'Dicas de Leitura', description: 'As recomendações de livros da nutricionista, por tema.', monthlyCents: 450 },
]

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
 *  Mensal R$ 59,90 (valor confirmado pelo usuário em 2026-11-17; separado
 *  seria R$ 75,10, com as Dicas de Leitura); semestral 20% e anual 35% de economia sobre o mensal. */
export const PREMIUM_MONTHLY_CENTS = 5990
export const PREMIUM_PRICES_CENTS: Record<PlanCycle, number> = {
  monthly: PREMIUM_MONTHLY_CENTS,
  semiannual: 28752,
  annual: 46722,
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
