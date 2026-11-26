// Carrossel 3D dos planos: cinco cartões num anel que dá a volta completa (360 graus), um de cada vez.
// Só a conta do movimento; o desenho fica em PlansCarousel3D.tsx.

export const SLOTS = 5
export const HOLD_S = 2.4
export const MOVE_S = 1.3
/** Ângulo entre dois cartões vizinhos do anel (72 graus com cinco cartões). */
export const STEP = (Math.PI * 2) / SLOTS

function ease(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * Quanto o anel já girou (radianos) depois de `t` segundos: o cartão da frente fica parado um tempo e então
 * o anel gira um passo, trazendo o próximo para a frente enquanto o da frente vai para trás. Nunca volta.
 */
export function ringAngle(t: number): number {
  if (!(t > 0)) return 0
  const cycle = HOLD_S + MOVE_S
  const n = Math.floor(t / cycle)
  const r = t - n * cycle
  const f = r < HOLD_S ? 0 : ease((r - HOLD_S) / MOVE_S)
  return (n + f) * STEP
}

/** Posição de um cartão no anel: x e z na circunferência (raio `radius`) e a direção em que ele olha. */
export function slotPose(baseAngle: number, ring: number, radius: number): { x: number; z: number; face: number; front: number } {
  const a = baseAngle - ring
  return { x: Math.sin(a) * radius, z: Math.cos(a) * radius, face: a, front: (Math.cos(a) + 1) / 2 }
}
