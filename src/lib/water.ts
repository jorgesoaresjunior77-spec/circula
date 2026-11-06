// Calculadora de água — estimativa EDUCATIVA, não prescrição.
//
// Fator usado: 35 ml por kg de peso corporal por dia, um ponto de partida
// comum em materiais educativos. Precisa ser confirmado pela nutricionista
// responsável antes de ir ao ar para todas as alunas; é uma constante só,
// de propósito, para ajustar num lugar.

export const WATER_ML_PER_KG = 35
/** Arredondamento da meta, para um número "redondo" de mostrar. */
const GOAL_STEP_ML = 50
/** Limites do peso aceito (o banco repete essa regra). */
export const WEIGHT_MIN_KG = 20
export const WEIGHT_MAX_KG = 300
/** Maior quantidade aceita num único registro (o banco repete essa regra). */
export const MAX_LOG_ML = 2000

/** Meta diária estimada, em ml, arredondada de 50 em 50. `null` se o peso é inválido. */
export function dailyGoalMl(weightKg: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_MIN_KG || weightKg > WEIGHT_MAX_KG) return null
  return Math.round((weightKg * WATER_ML_PER_KG) / GOAL_STEP_ML) * GOAL_STEP_ML
}

/** "2,45 L" */
export function formatLiters(ml: number): string {
  return `${(ml / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`
}

/** "2.450 ml" */
export function formatMl(ml: number): string {
  return `${ml.toLocaleString('pt-BR')} ml`
}

/** Progresso de 0 a 1 (a garrafa não passa de cheia). */
export function waterProgress(totalMl: number, goalMl: number | null): number {
  if (!goalMl || goalMl <= 0) return 0
  return Math.min(1, Math.max(0, totalMl / goalMl))
}

/** Aceita "62", "62,5" ou "62.5"; devolve `null` se não for um número. */
export function parseWeight(input: string): number | null {
  const n = Number(input.trim().replace(',', '.'))
  return Number.isFinite(n) && input.trim() !== '' ? n : null
}
