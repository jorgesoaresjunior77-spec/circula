// Destaque da capa de um negócio em "Na minha cidade": R$ 4,90 por mês, com desconto
// nos planos de 6 e 12 meses (mesma regra dos conteúdos avulsos: 16% e 33%).
// O preço vem SÓ daqui: o navegador nunca decide quanto cobrar.

export type HighlightCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'

export const HIGHLIGHT_MONTHLY_CENTS = 490

export function isHighlightCycle(v: unknown): v is HighlightCycle {
  return v === 'MONTHLY' || v === 'SEMIANNUALLY' || v === 'YEARLY'
}

function roundDime(cents: number): number {
  return Math.round(cents / 10) * 10
}

export function highlightPriceCents(cycle: HighlightCycle): number {
  if (cycle === 'MONTHLY') return HIGHLIGHT_MONTHLY_CENTS
  return cycle === 'SEMIANNUALLY'
    ? roundDime(HIGHLIGHT_MONTHLY_CENTS * 6 * 0.84)
    : roundDime(HIGHLIGHT_MONTHLY_CENTS * 12 * 0.67)
}
