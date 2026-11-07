// Catálogo da página de Planos. Valores em centavos.
//
// Descontos confirmados pelo usuário em 2026-11-07 (avulsos 16%/33%,
// superpacote 20%/35%). Hoje só a
// assinatura mensal do Círcula tem cobrança ligada (e o Asaas segue em
// Sandbox); os demais produtos aparecem como "em breve", sem compra.

export type PlanCycle = 'monthly' | 'semiannual' | 'annual'

export const CYCLE_MONTHS: Record<PlanCycle, number> = { monthly: 1, semiannual: 6, annual: 12 }
export const CYCLE_LABEL: Record<PlanCycle, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
}

export const CIRCULA_MONTHLY_CENTS = 1490
export const PRODUCT_MONTHLY_CENTS = 990

export interface CatalogProduct {
  key: 'magazine' | 'receitas' | 'ebooks'
  name: string
  description: string
}

export const PRODUCTS: CatalogProduct[] = [
  { key: 'magazine', name: 'Círcula Magazine', description: 'A revista mensal da comunidade.' },
  { key: 'receitas', name: 'Receitas', description: 'Receitas em formato de revista.' },
  { key: 'ebooks', name: 'E-books', description: 'Os e-books da nutricionista.' },
]

/** Preços de um produto avulso: semestral e anual com preço fechado. */
export const PRODUCT_PRICES_CENTS: Record<PlanCycle, number> = {
  monthly: 990,
  semiannual: 4980,
  annual: 7970,
}

/** Superpacote: Círcula + os 3 produtos. Descontos confirmados: 20% / 35%. */
export const PACK_MONTHLY_CENTS = CIRCULA_MONTHLY_CENTS + PRODUCTS.length * PRODUCT_MONTHLY_CENTS
export const PACK_PRICES_CENTS: Record<PlanCycle, number> = {
  monthly: PACK_MONTHLY_CENTS,
  semiannual: 21410,
  annual: 34790,
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
