// Poses dos desenhos dos exercícios. Cada pose é descrita por ÂNGULOS dos
// segmentos do corpo (0° = direita, 90° = para baixo, -90° = para cima, como
// na tela). O desenho calcula as posições, apoia o corpo no chão e centraliza
// pelo ponto de apoio, então a posição inicial e a execução ficam alinhadas.
// Os desenhos são próprios (traço elegante, sem fotos) e só mostram o corpo
// de lado, olhando para a direita.

export type Pt = [number, number]
type Arm = [number, number] | { reach: 'ankle1' | 'ankle2'; bend?: 1 | -1 }

export interface Pose {
  /** Ângulo do quadril ao ombro. */
  torso: number
  /** Curvatura da coluna (positivo arredonda para cima). */
  arch?: number
  /** Ângulo do pescoço (cabeça). Padrão: continua o tronco. */
  neck?: number
  /** Braço perto: [braço, antebraço] ou alcance até o tornozelo. */
  a1: Arm
  a2?: Arm
  /** Perna perto: [coxa, canela]. */
  l1: [number, number]
  l2?: [number, number]
  /** Ângulo do pé (padrão: perpendicular à canela, para a frente). */
  f1?: number
  f2?: number
  /** Objeto de apoio: parede (à frente das mãos) ou cadeira (sob o quadril). */
  prop?: 'wall' | 'chair'
  /** Ponto que fica fixo na horizontal. Padrão: tornozelo perto. */
  anchor?: 'ankle1' | 'wrist1' | 'hip'
}

export const LEN = { torso: 26, neck: 11, upper: 14, fore: 13, thigh: 20, shin: 20, foot: 7, head: 7 }

const rad = (d: number) => (d * Math.PI) / 180
const add = (p: Pt, deg: number, len: number): Pt => [p[0] + Math.cos(rad(deg)) * len, p[1] + Math.sin(rad(deg)) * len]

function ik(from: Pt, to: Pt, a: number, b: number, bend: 1 | -1): { mid: Pt; end: Pt } {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.01)
  const base = Math.atan2(dy, dx)
  const cosA = (a * a + d * d - b * b) / (2 * a * d)
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const mid: Pt = [from[0] + Math.cos(base + bend * ang) * a, from[1] + Math.sin(base + bend * ang) * a]
  const end: Pt = [from[0] + Math.cos(base) * d, from[1] + Math.sin(base) * d]
  return { mid, end }
}

export interface Solved {
  head: Pt
  shoulder: Pt
  hip: Pt
  arms: { near: [Pt, Pt, Pt]; far: [Pt, Pt, Pt] }
  legs: { near: [Pt, Pt, Pt, Pt]; far: [Pt, Pt, Pt, Pt] }
  prop?: { type: 'wall' | 'chair'; x: number; y: number }
  floorY: number
  /** Caixa que contém o corpo (para ajustar o enquadramento). */
  box: { x0: number; x1: number }
}

export const VIEW = { w: 160, h: 100, floor: 90, cx: 80 }

export function solvePose(p: Pose): Solved {
  const hip: Pt = [0, 0]
  const shoulder = add(hip, p.torso, LEN.torso)
  const head = add(shoulder, p.neck ?? p.torso, LEN.neck)

  const leg = (l: [number, number], foot: number | undefined): [Pt, Pt, Pt, Pt] => {
    const knee = add(hip, l[0], LEN.thigh)
    const ankle = add(knee, l[1], LEN.shin)
    const toe = add(ankle, foot ?? l[1] - 90, LEN.foot)
    return [hip, knee, ankle, toe]
  }
  const near = leg(p.l1, p.f1)
  const far = leg(p.l2 ?? p.l1, p.f2 ?? p.f1)
  if (!p.l2) {
    // perna de trás levemente aberta, para aparecer atrás da outra
    far[1] = [far[1][0] - 2, far[1][1]]
    far[2] = [far[2][0] - 2, far[2][1]]
    far[3] = [far[3][0] - 2, far[3][1]]
  }

  const arm = (a: Arm | undefined, ankle: Pt): [Pt, Pt, Pt] => {
    if (!a) a = [90, 90]
    if (Array.isArray(a)) {
      const elbow = add(shoulder, a[0], LEN.upper)
      return [shoulder, elbow, add(elbow, a[1], LEN.fore)]
    }
    const r = ik(shoulder, ankle, LEN.upper, LEN.fore, a.bend ?? 1)
    return [shoulder, r.mid, r.end]
  }
  const a1 = arm(p.a1, near[2])
  const a2 = arm(p.a2 ?? p.a1, near[2])

  // o chão fica no ponto mais baixo (sem contar a cabeça)
  const lows = [near[1], near[2], near[3], far[1], far[2], far[3], a1[1], a1[2], a2[1], a2[2], shoulder, hip]
  const maxY = Math.max(...lows.map((q) => q[1]))

  const anchorPt = p.anchor === 'wrist1' ? a1[2] : p.anchor === 'hip' ? hip : near[2]
  const dx = VIEW.cx - anchorPt[0]
  const dy = VIEW.floor - 3.5 - maxY
  const mv = (q: Pt): Pt => [q[0] + dx, q[1] + dy]

  const out: Solved = {
    head: mv(head),
    shoulder: mv(shoulder),
    hip: mv(hip),
    arms: { near: a1.map(mv) as [Pt, Pt, Pt], far: a2.map(mv) as [Pt, Pt, Pt] },
    legs: { near: near.map(mv) as [Pt, Pt, Pt, Pt], far: far.map(mv) as [Pt, Pt, Pt, Pt] },
    floorY: VIEW.floor,
    box: { x0: 0, x1: 0 },
  }
  const all = [out.head, out.shoulder, out.hip, ...out.arms.near, ...out.arms.far, ...out.legs.near, ...out.legs.far]
  out.box = { x0: Math.min(...all.map((q) => q[0])) - LEN.head, x1: Math.max(...all.map((q) => q[0])) + LEN.head }
  if (p.prop === 'wall') {
    const reach = Math.max(a1[2][0], a1[1][0])
    out.prop = { type: 'wall', x: reach + dx + 3, y: 0 }
  } else if (p.prop === 'chair') {
    out.prop = { type: 'chair', x: VIEW.cx - 22, y: VIEW.floor - 22 }
  }
  return out
}

const STAND: Pose = { torso: -90, a1: [92, 92], l1: [90, 90] }

const QUAD_BASE: Pose = { torso: -15, a1: [90, 90], l1: [90, 180], a2: [90, 90], l2: [90, 180], anchor: 'wrist1' }

export const POSES: Record<string, Pose> = {
  stand: STAND,

  // Agachamento
  squat_start: { ...STAND, a1: [95, 92] },
  squat_down: { torso: -55, a1: [0, 0], l1: [8, 100], anchor: 'ankle1' },

  // Afundo
  lunge_start: { ...STAND },
  lunge_down: { torso: -90, a1: [95, 92], l1: [10, 90], l2: [105, 170], f2: 80 },

  // Elevação de quadril (ponte)
  bridge_start: { torso: 180, neck: -150, a1: [0, 0], l1: [-60, 80], anchor: 'hip' },
  bridge_up: { torso: 155, neck: -165, a1: [0, 0], l1: [-22, 90], f1: 0, anchor: 'ankle1' },

  // Prancha
  plank_start: { torso: -5, a1: [90, 0], l1: [135, 180], f1: 180, prop: undefined, anchor: 'wrist1' },
  plank_hold: { torso: -6, a1: [90, 0], l1: [174, 174], anchor: 'wrist1' },

  // Abdominal
  crunch_start: { torso: 180, neck: -150, a1: [-100, 150], l1: [-60, 80], anchor: 'hip' },
  crunch_up: { torso: 215, neck: -140, a1: [-100, 150], l1: [-60, 80], anchor: 'hip' },

  // Flexão de braço apoiada nos joelhos
  pushknee_start: { torso: -31, a1: [90, 90], l1: [149, 205], anchor: 'wrist1' },
  pushknee_down: { torso: -16, a1: [125, 20], l1: [164, 200], anchor: 'wrist1' },

  // Flexão na parede
  wallpush_start: { torso: -86, a1: [-5, 0], l1: [94, 94], prop: 'wall', anchor: 'ankle1' },
  wallpush_in: { torso: -68, a1: [40, -25], l1: [112, 112], prop: 'wall', anchor: 'ankle1' },

  // Marcha no lugar
  march_start: { ...STAND, a1: [60, 120], a2: [120, 60] },
  march_up: { torso: -90, a1: [40, 150], a2: [140, 30], l1: [5, 90], l2: [90, 90] },

  // Elevação de perna em quatro apoios
  kick_start: { ...QUAD_BASE },
  kick_up: { ...QUAD_BASE, l1: [182, -95] },

  // Superman
  superman_start: { torso: 0, neck: 0, a1: [0, 0], l1: [180, 180], f1: 90, anchor: 'hip' },
  superman_up: { torso: -10, neck: -25, a1: [-12, -12], l1: [192, 192], f1: 90, anchor: 'hip' },

  // Cachorro-pássaro
  birddog_start: { ...QUAD_BASE },
  birddog_ext: { ...QUAD_BASE, a1: [0, 0], l2: [180, 180], l1: [90, 180] },

  // Sentar e levantar da cadeira
  chair_start: { torso: -80, a1: [0, 0], l1: [0, 90], prop: 'chair', anchor: 'ankle1' },
  chair_up: { torso: -90, a1: [0, 0], l1: [90, 90], prop: 'chair', anchor: 'ankle1' },

  // Gato e vaca
  cat: { ...QUAD_BASE, torso: -8, arch: 9, neck: 70 },
  cow: { ...QUAD_BASE, torso: -20, arch: -7, neck: -40 },

  // Alongamento de quadríceps em pé
  quad_start: { ...STAND },
  quad_stretch: { torso: -90, a1: { reach: 'ankle1', bend: -1 }, a2: [92, 92], l1: [96, 215], l2: [90, 90], f1: 200 },

  // Alongamento da parte de trás das pernas
  hamstring_start: { ...STAND },
  hamstring_fold: { torso: 40, neck: 60, a1: [85, 85], l1: [90, 90] },

  // Equilíbrio em uma perna
  balance_start: { ...STAND, a1: [20, 20] },
  balance_lift: { torso: -90, a1: [-5, -5], a2: [-5, -5], l1: [30, 30], l2: [90, 90] },

  // Elevação de calcanhares
  calf_start: { ...STAND },
  calf_up: { ...STAND, f1: 58, f2: 58 },

  // Elevação de braços
  armraise_start: { ...STAND },
  armraise_up: { torso: -90, a1: [-88, -88], a2: [-92, -92], l1: [90, 90] },

  // Posição da criança
  child_start: { torso: -90, a1: [90, 60], l1: [15, 175], f1: 180, anchor: 'hip' },
  child_fold: { torso: 8, neck: 40, a1: [5, 5], l1: [15, 175], f1: 180, anchor: 'hip' },

  // Abertura de peito
  chest_start: { ...STAND },
  chest_open: { torso: -95, neck: -105, a1: [150, 140], a2: [155, 145], l1: [90, 90] },
}
