// Topo do app (hero): a nutricionista cadastra até 6 imagens (hero_1 a hero_6) e o app mostra uma por dia,
// 24 horas cada, na ordem. A troca acontece sozinha à meia-noite do horário do aparelho.
// Campos vazios são pulados: com 3 imagens, o ciclo é de 3 dias.

export const HERO_KEYS = ['hero_1', 'hero_2', 'hero_3', 'hero_4', 'hero_5', 'hero_6'] as const
export type HeroKey = (typeof HERO_KEYS)[number]

/** Número do dia (contado do calendário local, não de blocos de 24h a partir de uma hora qualquer). */
export function dayNumber(now: Date = new Date()): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
}

/** Caminho da imagem do dia, ou null se nenhum campo foi preenchido. */
export function heroOfTheDay(images: Partial<Record<string, string>>, now: Date = new Date()): string | null {
  const filled = HERO_KEYS.map((k) => images[k]).filter((p): p is string => !!p)
  if (filled.length === 0) return null
  return filled[dayNumber(now) % filled.length]
}
