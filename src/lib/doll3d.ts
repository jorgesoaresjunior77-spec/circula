// Boneca 3D (Antes de Tudo e IMC): contas que não dependem do Three.js, para
// poder testar. A figura é feita de formas arredondadas (esferas, cápsulas e um
// sólido de revolução para o vestido).

import type { ImcBand } from './imc'

/** Largura da cintura e do quadril por faixa do IMC (os ombros e a altura não mudam). */
export const BAND_WIDTH: Record<ImcBand, number> = {
  abaixo: 0.86,
  referencia: 1,
  acima: 1.14,
  elevado: 1.3,
}

/** Os 7 hábitos do ritual, na mesma ordem de lib/habits. */
export const HABIT_KEYS = ['luz', 'agua', 'exercicio', 'leitura', 'respiracao', 'organizacao', 'espiritualidade'] as const
export type HabitPropKey = (typeof HABIT_KEYS)[number]

/** Cada adereço da boneca: 1 se o hábito foi marcado hoje, 0 se não. */
export function propTargets(checked: ReadonlySet<string>): Record<HabitPropKey, number> {
  const out = {} as Record<HabitPropKey, number>
  for (const k of HABIT_KEYS) out[k] = checked.has(k) ? 1 : 0
  return out
}

/**
 * Mistura uma cor (0xRRGGBB) com o seu cinza: `amount` 1 = a cor original,
 * 0 = preto e branco. É assim que a boneca ganha cor aos poucos.
 */
export function grayMix(hex: number, amount: number): number {
  const a = Math.min(1, Math.max(0, amount))
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  const mix = (c: number) => Math.round(gray + (c - gray) * a)
  return (mix(r) << 16) | (mix(g) << 8) | mix(b)
}

/**
 * Pontos (raio, altura) do vestido, de baixo para cima, para o sólido de
 * revolução. `f` é a largura da cintura/quadril (1 = referência). A curva final
 * é suavizada no componente, então aqui bastam poucos pontos de controle.
 */
export function dressProfile(f: number): [number, number][] {
  return [
    [0.02, 0.4],
    [0.6 * f, 0.4],
    [0.58 * f, 0.62],
    [0.44 * f, 1.0],
    [0.3 * f, 1.3],
    [0.25 * f, 1.46],
    [0.29, 1.66],
    [0.34, 1.86],
    [0.3, 2.04],
    [0.16, 2.14],
    [0.02, 2.16],
  ]
}

/** Largura de referência do vestido na altura da cintura, para conferir a proporção. */
export function waistRadius(f: number): number {
  return dressProfile(f)[5][0]
}
