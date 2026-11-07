// IMC (índice de massa corporal) — cálculo simples, feito só no aparelho.
// Nada é guardado. O texto é neutro e informativo, sem julgamento.

export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 230
export const IMC_WEIGHT_MIN_KG = 20
export const IMC_WEIGHT_MAX_KG = 400

export function parseDecimal(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function calcImc(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Faixas de referência da OMS para adultos. */
export function imcRange(imc: number): string {
  if (imc < 18.5) return 'abaixo da faixa de referência'
  if (imc < 25) return 'dentro da faixa de referência'
  if (imc < 30) return 'acima da faixa de referência'
  return 'bem acima da faixa de referência'
}
