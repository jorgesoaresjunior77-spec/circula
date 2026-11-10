// Garrafa de água 3D: contas e decisões que não dependem do Three.js (assim
// dá para testar e o arquivo pesado só carrega quando a garrafa 3D é usada).
//
// Unidades da cena: a garrafa tem 2,4 de altura, de y = -1,2 (base) a y = 1,2
// (boca). Os pontos são (raio, altura) e viram um sólido de revolução.

export type Point = readonly [number, number]

/** Silhueta externa, da base à boca: corpo reto, ombro, gargalo e borda. */
export const OUTER_PROFILE: readonly Point[] = [
  [0, -1.2],
  [0.4, -1.2],
  [0.55, -1.18],
  [0.62, -1.12],
  [0.66, -1.02],
  [0.67, -0.9],
  [0.67, 0.2],
  [0.665, 0.38],
  [0.64, 0.52],
  [0.58, 0.66],
  [0.46, 0.8],
  [0.34, 0.9],
  [0.27, 0.97],
  [0.26, 1.05],
  [0.26, 1.12],
  [0.29, 1.14],
  [0.29, 1.18],
]

/** Espessura da parede de vidro. */
export const GLASS_THICKNESS = 0.045

/** Parede interna: o desenho externo encolhido pela espessura do vidro. */
export const INNER_PROFILE: readonly Point[] = OUTER_PROFILE.slice(0, 14).map(([r, y], i): Point => [
  Math.max(0, r - GLASS_THICKNESS),
  i <= 3 ? y + 0.06 : y,
])

export const WATER_BOTTOM_Y = INNER_PROFILE[1][1]
/** Garrafa "cheia" (100% da meta): a água chega ao início do gargalo. */
export const WATER_FULL_Y = 0.9

/** Raio interno da garrafa numa altura (interpola entre os pontos). */
export function innerRadiusAt(y: number): number {
  const pts = INNER_PROFILE
  if (y <= pts[0][1]) return pts[0][0]
  for (let i = 1; i < pts.length; i += 1) {
    const [r0, y0] = pts[i - 1]
    const [r1, y1] = pts[i]
    if (y <= y1) {
      if (y1 === y0) return r1
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
    }
  }
  return pts[pts.length - 1][0]
}

const VOLUME_STEP = 0.005

/** Volume interno (relativo) da base até a altura `y`: soma de π·r²·dy. */
export function volumeUpTo(y: number): number {
  let v = 0
  for (let h = WATER_BOTTOM_Y; h < y; h += VOLUME_STEP) {
    const top = Math.min(y, h + VOLUME_STEP)
    const r = innerRadiusAt((h + top) / 2)
    v += Math.PI * r * r * (top - h)
  }
  return v
}

const FULL_VOLUME = volumeUpTo(WATER_FULL_Y)

/**
 * Altura da superfície da água para uma fração da meta (0 a 1). A conta é
 * pelo VOLUME, não pela altura: o ombro e o gargalo são estreitos, então a
 * metade da água já fica um pouco abaixo da metade da altura. O dado real (ml registrados
 * dividido pela meta) é quem manda; nada é inventado aqui.
 */
export function waterTopY(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  if (p === 0) return WATER_BOTTOM_Y
  if (p === 1) return WATER_FULL_Y
  const target = p * FULL_VOLUME
  let lo = WATER_BOTTOM_Y
  let hi = WATER_FULL_Y
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2
    if (volumeUpTo(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Aproxima `current` de `target` de forma suave, independente da taxa de quadros. */
export function easeToward(current: number, target: number, dtSeconds: number, halfLifeSeconds = 0.35): number {
  if (dtSeconds <= 0) return current
  const k = 1 - Math.pow(0.5, dtSeconds / halfLifeSeconds)
  const next = current + (target - current) * k
  return Math.abs(target - next) < 0.0005 ? target : next
}

export interface Slosh {
  /** Inclinação da superfície (vai e volta, amortecida). */
  x: number
  v: number
}

/** Mola amortecida: a água balança quando o nível muda e vai se acalmando. */
export function stepSlosh(s: Slosh, dtSeconds: number, kick = 0): Slosh {
  const dt = Math.min(dtSeconds, 0.05)
  const stiffness = 38
  const damping = 3.6
  const v = (s.v + kick - stiffness * s.x * dt - damping * s.v * dt)
  const x = s.x + v * dt
  return Math.abs(x) < 0.0005 && Math.abs(v) < 0.0005 ? { x: 0, v: 0 } : { x, v }
}

export interface BottleEnv {
  reducedMotion: boolean
  hasWebGL: boolean
  saveData?: boolean
  deviceMemory?: number
  hardwareConcurrency?: number
  /** 'svg' ou '3d' guardado no aparelho (suporte e testes). */
  force?: string | null
}

/**
 * Usa a garrafa 3D só quando vale a pena: com WebGL, sem pedido de menos
 * movimento, sem economia de dados e em aparelho que não seja fraco. Nos
 * outros casos, fica a garrafa SVG de sempre.
 */
export function shouldUse3D(env: BottleEnv): boolean {
  if (env.force === 'svg') return false
  if (!env.hasWebGL) return false
  if (env.force === '3d') return true
  if (env.reducedMotion || env.saveData) return false
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return false
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 2) return false
  return true
}

/** Lê o ambiente do navegador. Nunca lança: na dúvida, fica no SVG. */
export function detectBottleEnv(): BottleEnv {
  let reducedMotion = false
  let hasWebGL = false
  let force: string | null = null
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reducedMotion = false
  }
  try {
    // jsdom e navegadores sem WebGL não têm esta interface.
    if (typeof WebGLRenderingContext !== 'undefined') {
      const canvas = document.createElement('canvas')
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null
      hasWebGL = !!gl
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    hasWebGL = false
  }
  try {
    force = window.localStorage.getItem('circula:bottle')
  } catch {
    force = null
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return {
    reducedMotion,
    hasWebGL,
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    force,
  }
}
