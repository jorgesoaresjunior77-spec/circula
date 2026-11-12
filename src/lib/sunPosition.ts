// Posição aproximada do sol ao longo do dia, para o girassol do Meu Jardim
// "olhar" para ele. Não é astronomia: do nascer (6h) ao pôr (18h) o sol
// atravessa o céu da esquerda para a direita, mais alto ao meio-dia.

export const SUNRISE_HOUR = 6
export const SUNSET_HOUR = 18

/** 0 no nascer, 0,5 ao meio-dia, 1 no pôr do sol; null de noite. */
export function sunProgress(at: Date = new Date()): number | null {
  const hour = at.getHours() + at.getMinutes() / 60
  if (hour < SUNRISE_HOUR || hour > SUNSET_HOUR) return null
  return (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)
}

/** Altura do sol no arco: 0 no horizonte, 1 no ponto mais alto. */
export function sunHeight(progress: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, progress)))
}

/**
 * Inclinação da flor (graus) para encarar o sol: gira para a esquerda de
 * manhã, para a direita à tarde, e ergue o rosto ao meio-dia. De noite, fica
 * de frente e levemente abaixada.
 */
export function sunflowerTilt(progress: number | null): { rotateX: number; rotateY: number } {
  if (progress === null) return { rotateX: 16, rotateY: 0 }
  const p = Math.min(1, Math.max(0, progress))
  return {
    rotateY: Math.round((p - 0.5) * 2 * 30),
    rotateX: Math.round(8 - 20 * sunHeight(p)),
  }
}
