// IMC (índice de massa corporal) — cálculo simples, feito só no aparelho.
// Nada é guardado. O texto é neutro e acolhedor, sem julgamento, e deixa
// claro que o IMC não é diagnóstico.

export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 230
export const IMC_WEIGHT_MIN_KG = 20
export const IMC_WEIGHT_MAX_KG = 400

export type ImcBand = 'abaixo' | 'referencia' | 'acima' | 'elevado'

export function parseDecimal(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function calcImc(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Escala desenhada na tela do resultado (só visual): de 14 a 36. */
export const IMC_SCALE_MIN = 14
export const IMC_SCALE_MAX = 36

/** Onde o IMC cai na escala, de 0 (esquerda) a 1 (direita); fora dela, nas pontas. */
export function scalePosition(imc: number): number {
  const p = (imc - IMC_SCALE_MIN) / (IMC_SCALE_MAX - IMC_SCALE_MIN)
  return Math.min(1, Math.max(0, p))
}

/** Os cortes das faixas (18,5 / 25 / 30) como fração da escala. */
export function scaleStops(): [number, number, number] {
  return [18.5, 25, 30].map((v) => scalePosition(v)) as [number, number, number]
}

/** Faixas de referência da OMS para adultos. */
export function imcBand(imc: number): ImcBand {
  if (imc < 18.5) return 'abaixo'
  if (imc < 25) return 'referencia'
  if (imc < 30) return 'acima'
  return 'elevado'
}

export function imcRange(imc: number): string {
  const band = imcBand(imc)
  if (band === 'abaixo') return 'abaixo da faixa de referência'
  if (band === 'referencia') return 'dentro da faixa de referência'
  if (band === 'acima') return 'acima da faixa de referência'
  return 'bem acima da faixa de referência'
}

/** Rótulo curto da classificação. */
export const IMC_LABEL: Record<ImcBand, string> = {
  abaixo: 'Abaixo da faixa de referência',
  referencia: 'Dentro da faixa de referência',
  acima: 'Acima da faixa de referência',
  elevado: 'Bem acima da faixa de referência',
}

/** Mensagem acolhedora por faixa. Sem julgamento e sem promessa de resultado. */
export const IMC_MESSAGE: Record<ImcBand, string> = {
  abaixo: 'Seu corpo merece cuidado e atenção. Vamos acompanhar sua evolução com carinho?',
  referencia: 'Você está dentro da faixa de referência. Continue cuidando de você!',
  acima:
    'Seu resultado está acima da faixa de referência. Pequenas mudanças e acompanhamento profissional podem ajudar.',
  elevado:
    'Seu resultado está bem acima da faixa de referência. Uma conversa com uma nutricionista pode ajudar a entender o seu caso com cuidado, no seu ritmo.',
}
