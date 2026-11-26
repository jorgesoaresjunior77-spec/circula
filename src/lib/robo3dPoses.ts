// Poses da Livi em 3D: para cada cena do robô, onde ficam os braços, a cabeça e qual é a expressão do rosto.
// Só os números; o desenho fica em Robo3D.tsx. "esq" e "dir" são do ponto de vista de quem olha a tela.

export type FaceKind = 'open' | 'blink' | 'happy' | 'wink' | 'wow' | 'think' | 'oops' | 'plead' | 'love'

/** Braço: [para fora, para a frente, dobra do cotovelo] em radianos (0 = solto ao lado do corpo). */
export type ArmPose = [number, number, number]

export interface RoboPose {
  esq: ArmPose
  dir: ArmPose
  /** Braço que acena (balança o antebraço). */
  acena?: 'esq' | 'dir'
  /** Inclinação lateral e virada da cabeça. */
  cabeca: [number, number]
  /** Quanto o corpo "pula" (comemoração). */
  pulo?: number
  face: FaceKind
  coracao?: boolean
}

const SOLTO: ArmPose = [0.2, 0, -0.12]

/** Nomes iguais aos de RoboCena (RoboGuia.tsx). */
export const POSES: Record<string, RoboPose> = {
  neutro: { esq: [1.05, -0.2, -0.9], dir: SOLTO, cabeca: [0, 0.05], face: 'open' },
  'neutro-piscando': { esq: [1.05, -0.2, -0.9], dir: SOLTO, cabeca: [0, 0.05], face: 'blink' },
  feliz: { esq: SOLTO, dir: SOLTO, cabeca: [0.05, 0], face: 'happy' },
  piscadinha: { esq: SOLTO, dir: [0.9, -0.3, -1.3], cabeca: [-0.08, 0.1], face: 'wink' },
  'aponta-direita': { esq: SOLTO, dir: [1.15, -0.1, -0.1], cabeca: [0, -0.28], face: 'open' },
  'aponta-esquerda': { esq: [1.15, -0.1, -0.1], dir: SOLTO, cabeca: [0, 0.28], face: 'open' },
  'aponta-cima': { esq: SOLTO, dir: [2.7, 0, -0.05], cabeca: [0, 0], face: 'open' },
  'aponta-baixo': { esq: SOLTO, dir: [0.55, -0.45, -0.1], cabeca: [0, 0], face: 'open' },
  pensando: { esq: SOLTO, dir: [0.35, -1.0, -1.9], cabeca: [0.1, 0.12], face: 'think' },
  acena: { esq: SOLTO, dir: [2.3, 0, -0.55], acena: 'dir', cabeca: [0, 0], face: 'happy' },
  'boas-vindas': { esq: [1.0, -0.3, -0.5], dir: [2.3, 0, -0.55], acena: 'dir', cabeca: [0, 0], face: 'happy' },
  surpresa: { esq: [0.95, -0.2, -0.3], dir: [0.95, -0.2, -0.3], cabeca: [0, 0], face: 'wow' },
  oops: { esq: [0.55, -0.7, -1.4], dir: SOLTO, cabeca: [0.12, 0.15], face: 'oops' },
  apresenta: { esq: [1.05, -0.2, -0.9], dir: SOLTO, cabeca: [0, 0.05], face: 'happy' },
  pedindo: { esq: [0.3, -0.95, -1.5], dir: [0.3, -0.95, -1.5], cabeca: [0.1, 0], face: 'plead' },
  comemora: { esq: [2.6, 0, -0.2], dir: [2.6, 0, -0.2], cabeca: [0, 0], pulo: 1, face: 'happy' },
  coracao: { esq: [0.35, -0.8, -1.5], dir: [0.35, -0.8, -1.5], cabeca: [0.06, 0], face: 'love', coracao: true },
}

export function poseDa(cena: string): RoboPose {
  return POSES[cena] ?? POSES.neutro
}
