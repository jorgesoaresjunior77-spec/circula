// Poses da mulher 3D do Exercite Diário. Cada exercício pertence a uma
// "família" de movimento com duas poses (início e fim da execução); a
// animação vai do início ao fim e volta, como na execução real. Ângulos em
// graus. Convenções (mulher de frente para a câmera, +X = lado esquerdo dela):
//  • pitch: inclina o corpo inteiro (+90 = deitada de barriga para baixo,
//    -90 = deitada de barriga para cima, +20 = inclinada para a frente);
//  • spine: + curva o tronco para a frente; neck: + abaixa a cabeça;
//  • shFlex: + leva o braço para a frente/para cima (180 = acima da cabeça);
//  • shAbd: + abre o braço para o lado; elbow: + dobra o cotovelo;
//  • ankle: + aponta os pés (sobe o calcanhar); em pé o pé fica apoiado sozinho;
//  • hipFlex: + leva a coxa para a frente; hipAbd: + abre a perna; knee: + dobra.
// As poses foram feitas à mão a partir dos passos de cada exercício.

export type Joint =
  | 'pitch' | 'roll' | 'spine' | 'twist' | 'neck'
  | 'lShFlex' | 'lShAbd' | 'lElbow' | 'rShFlex' | 'rShAbd' | 'rElbow'
  | 'lHipFlex' | 'lHipAbd' | 'lKnee' | 'rHipFlex' | 'rHipAbd' | 'rKnee'
  | 'lAnkle' | 'rAnkle'

export type Pose = Partial<Record<Joint, number>>

export type Anchor = 'feet' | 'hands' | 'pelvis' | 'knees'
export type Track = 'pelvis' | 'lHand' | 'rHand' | 'lFoot' | 'rFoot' | 'head' | 'chest' | 'lKnee' | 'rKnee'
export type Prop = 'chair' | 'wall-front' | 'wall-back' | 'step' | 'bottles' | 'mat'

export interface Motion {
  /** Vista da câmera: de lado (perfil), três-quartos ou de frente. */
  view: 'side' | 'three' | 'front'
  a: Pose
  b: Pose
  /** Isométrico (segurar): só respira entre A e B, devagar. */
  hold?: boolean
  anchor: Anchor
  /** Ponto do corpo que a seta acompanha (de A até B). */
  track?: Track
  props?: Prop[]
  /** Duração de um ciclo completo (s). */
  period?: number
}

const STAND: Pose = { lShAbd: 8, rShAbd: 8, lElbow: 8, rElbow: 8 }
const SUPINE_KNEES: Pose = { pitch: -90, lHipFlex: 55, rHipFlex: 55, lKnee: 105, rKnee: 105, lShFlex: 0, rShFlex: 0 }
const QUAD: Pose = { pitch: 90, lShFlex: 90, rShFlex: 90, lHipFlex: 90, rHipFlex: 90, lKnee: 90, rKnee: 90, neck: -10 }
const PRONE: Pose = { pitch: 90, lShFlex: 170, rShFlex: 170, neck: -8 }

export const FAMILIES: Record<string, Motion> = {
  squat: {
    view: 'side', anchor: 'feet', track: 'pelvis',
    a: { ...STAND, lShFlex: 10, rShFlex: 10 },
    b: { spine: 32, lHipFlex: 96, rHipFlex: 96, lKnee: 108, rKnee: 108, lShFlex: 85, rShFlex: 85, lElbow: 5, rElbow: 5 },
  },
  sumo: {
    view: 'front', anchor: 'feet', track: 'pelvis',
    a: { lHipAbd: 22, rHipAbd: 22, lShFlex: 70, rShFlex: 70, lElbow: 110, rElbow: 110, lShAbd: 10, rShAbd: 10 },
    b: { lHipAbd: 40, rHipAbd: 40, lHipFlex: 55, rHipFlex: 55, lKnee: 85, rKnee: 85, spine: 8, lShFlex: 70, rShFlex: 70, lElbow: 110, rElbow: 110, lShAbd: 10, rShAbd: 10 },
  },
  wallsit: {
    view: 'side', anchor: 'feet', hold: true, props: ['wall-back'],
    a: { lHipFlex: 90, rHipFlex: 90, lKnee: 90, rKnee: 90, lShFlex: 55, rShFlex: 55, lElbow: 120, rElbow: 120 },
    b: { lHipFlex: 88, rHipFlex: 88, lKnee: 88, rKnee: 88, lShFlex: 55, rShFlex: 55, lElbow: 120, rElbow: 120, spine: 2 },
  },
  lunge: {
    view: 'side', anchor: 'feet', track: 'pelvis',
    a: { lHipFlex: 28, rHipFlex: -22, rAnkle: 20, lShAbd: 12, rShAbd: 12 },
    b: { lHipFlex: 82, lKnee: 92, rHipFlex: -12, rKnee: 100, rAnkle: 45, lShAbd: 12, rShAbd: 12 },
  },
  stepup: {
    view: 'side', anchor: 'feet', track: 'pelvis', props: ['step'],
    a: { ...STAND, lHipFlex: 60, lKnee: 70 },
    b: { ...STAND, lHipFlex: 8, lKnee: 4, rHipFlex: -8, rKnee: 40 },
  },
  bridge: {
    view: 'side', anchor: 'feet', track: 'pelvis', props: ['mat'],
    a: { ...SUPINE_KNEES },
    b: { pitch: -116, lHipFlex: 22, rHipFlex: 22, lKnee: 100, rKnee: 100, lShFlex: -26, rShFlex: -26 },
  },
  bridgeOne: {
    view: 'side', anchor: 'feet', track: 'pelvis', props: ['mat'],
    a: { ...SUPINE_KNEES, lHipFlex: 80, lKnee: 0 },
    b: { pitch: -116, rHipFlex: 22, rKnee: 100, lHipFlex: 50, lKnee: 0, lShFlex: -26, rShFlex: -26 },
  },
  plank: {
    view: 'side', anchor: 'hands', hold: true, props: ['mat'],
    a: { pitch: 80, lShFlex: 90, rShFlex: 90, lElbow: 90, rElbow: 90 },
    b: { pitch: 79, lShFlex: 91, rShFlex: 91, lElbow: 90, rElbow: 90, spine: -2 },
  },
  highPlank: {
    view: 'side', anchor: 'hands', hold: true, props: ['mat'],
    a: { pitch: 72, lShFlex: 72, rShFlex: 72 },
    b: { pitch: 71, lShFlex: 73, rShFlex: 73, spine: -2 },
  },
  shoulderTap: {
    view: 'three', anchor: 'hands', track: 'rHand', props: ['mat'],
    a: { pitch: 72, lShFlex: 72, rShFlex: 72, lHipAbd: 8, rHipAbd: 8 },
    b: { pitch: 72, lShFlex: 72, rShFlex: 40, rShAbd: -30, rElbow: 140, lHipAbd: 8, rHipAbd: 8 },
  },
  climber: {
    view: 'side', anchor: 'hands', track: 'lKnee', props: ['mat'],
    a: { pitch: 72, lShFlex: 72, rShFlex: 72 },
    b: { pitch: 70, lShFlex: 74, rShFlex: 74, lHipFlex: 100, lKnee: 110, spine: 10 },
  },
  crunch: {
    view: 'side', anchor: 'pelvis', track: 'head', props: ['mat'],
    a: { ...SUPINE_KNEES, lShFlex: 150, rShFlex: 150, lShAbd: 35, rShAbd: 35, lElbow: 130, rElbow: 130 },
    b: { ...SUPINE_KNEES, spine: 34, neck: 12, lShFlex: 150, rShFlex: 150, lShAbd: 35, rShAbd: 35, lElbow: 130, rElbow: 130 },
  },
  legRaise: {
    view: 'side', anchor: 'pelvis', track: 'lFoot', props: ['mat'],
    a: { pitch: -90, lHipFlex: 10, rHipFlex: 10, lShFlex: -5, rShFlex: -5 },
    b: { pitch: -90, lHipFlex: 85, rHipFlex: 85, lShFlex: -5, rShFlex: -5 },
  },
  reverseCrunch: {
    view: 'side', anchor: 'pelvis', track: 'lKnee', props: ['mat'],
    a: { pitch: -90, lHipFlex: 70, rHipFlex: 70, lKnee: 95, rKnee: 95, lShFlex: -5, rShFlex: -5 },
    b: { pitch: -90, lHipFlex: 120, rHipFlex: 120, lKnee: 100, rKnee: 100, spine: -8, lShFlex: -5, rShFlex: -5 },
  },
  bicycle: {
    view: 'three', anchor: 'pelvis', track: 'lKnee', props: ['mat'],
    a: { pitch: -90, spine: 28, twist: 18, lHipFlex: 100, lKnee: 100, rHipFlex: 30, rKnee: 10, lShFlex: 150, rShFlex: 150, lShAbd: 35, rShAbd: 35, lElbow: 130, rElbow: 130 },
    b: { pitch: -90, spine: 28, twist: -18, rHipFlex: 100, rKnee: 100, lHipFlex: 30, lKnee: 10, lShFlex: 150, rShFlex: 150, lShAbd: 35, rShAbd: 35, lElbow: 130, rElbow: 130 },
  },
  deadBug: {
    view: 'side', anchor: 'pelvis', track: 'rHand', props: ['mat'],
    a: { pitch: -90, lHipFlex: 90, rHipFlex: 90, lKnee: 90, rKnee: 90, lShFlex: 90, rShFlex: 90 },
    b: { pitch: -90, lHipFlex: 90, lKnee: 90, rHipFlex: 25, rKnee: 15, lShFlex: 90, rShFlex: 175 },
  },
  kneesToChest: {
    view: 'side', anchor: 'pelvis', track: 'lKnee', props: ['mat'],
    a: { ...SUPINE_KNEES },
    b: { pitch: -90, lHipFlex: 125, rHipFlex: 125, lKnee: 120, rKnee: 120, lShFlex: 60, rShFlex: 60, lElbow: 60, rElbow: 60 },
  },
  kneePushup: {
    view: 'side', anchor: 'knees', track: 'chest', props: ['mat'],
    a: { pitch: 62, lShFlex: 62, rShFlex: 62, lKnee: 95, rKnee: 95 },
    b: { pitch: 80, lShFlex: 15, rShFlex: 15, lElbow: 65, rElbow: 65, lKnee: 95, rKnee: 95 },
  },
  wallPushup: {
    view: 'side', anchor: 'feet', track: 'chest', props: ['wall-front'],
    a: { pitch: 16, lShFlex: 92, rShFlex: 92 },
    b: { pitch: 30, lShFlex: 40, rShFlex: 40, lElbow: 70, rElbow: 70 },
  },
  inclinePushup: {
    view: 'side', anchor: 'feet', track: 'chest', props: ['chair'],
    a: { pitch: 48, lShFlex: 75, rShFlex: 75 },
    b: { pitch: 60, lShFlex: 30, rShFlex: 30, lElbow: 57, rElbow: 57 },
  },
  march: {
    view: 'three', anchor: 'feet', track: 'lKnee', period: 1.6,
    a: { lHipFlex: 70, lKnee: 80, rShFlex: 40, lShFlex: -25, lElbow: 85, rElbow: 85 },
    b: { rHipFlex: 70, rKnee: 80, lShFlex: 40, rShFlex: -25, lElbow: 85, rElbow: 85 },
  },
  heelToe: {
    view: 'side', anchor: 'feet', track: 'lFoot', period: 2,
    a: { ...STAND, lHipFlex: 15, rHipFlex: -10, lAnkle: -15, rAnkle: 20 },
    b: { ...STAND, rHipFlex: 15, lHipFlex: -10, rAnkle: -15, lAnkle: 20 },
  },
  quadLeg: {
    view: 'side', anchor: 'hands', track: 'lFoot', props: ['mat'],
    a: { ...QUAD },
    b: { ...QUAD, lHipFlex: -12, lKnee: 90 },
  },
  superman: {
    view: 'side', anchor: 'pelvis', track: 'lHand', props: ['mat'],
    a: { ...PRONE },
    b: { ...PRONE, spine: -18, neck: -12, lShFlex: 182, rShFlex: 182, lHipFlex: -16, rHipFlex: -16 },
  },
  swimmer: {
    view: 'three', anchor: 'pelvis', track: 'lHand', props: ['mat'], period: 1.8,
    a: { ...PRONE, spine: -14, lShFlex: 190, rShFlex: 160, lHipFlex: -6, rHipFlex: -18 },
    b: { ...PRONE, spine: -14, lShFlex: 160, rShFlex: 190, lHipFlex: -18, rHipFlex: -6 },
  },
  birdDog: {
    view: 'side', anchor: 'knees', track: 'rHand', props: ['mat'],
    a: { ...QUAD },
    b: { ...QUAD, rShFlex: 175, lHipFlex: -5, lKnee: 0 },
  },
  sitStand: {
    view: 'side', anchor: 'feet', track: 'pelvis', props: ['chair'],
    a: { lHipFlex: 92, rHipFlex: 92, lKnee: 92, rKnee: 92, spine: 12, lShFlex: 70, rShFlex: 70, lElbow: 100, rElbow: 100, lShAbd: 12, rShAbd: 12 },
    b: { lShFlex: 70, rShFlex: 70, lElbow: 100, rElbow: 100, lShAbd: 12, rShAbd: 12 },
  },
  catCow: {
    view: 'side', anchor: 'hands', track: 'chest', props: ['mat'], period: 4,
    // gato: costas arredondadas para cima, cabeça baixa; vaca: costas para baixo, olhar à frente
    a: { ...QUAD, pitch: 76, spine: 34, lShFlex: 110, rShFlex: 110, lHipFlex: 76, rHipFlex: 76, neck: 34 },
    b: { ...QUAD, pitch: 100, spine: -26, lShFlex: 74, rShFlex: 74, lHipFlex: 100, rHipFlex: 100, neck: -30 },
  },
  quadStretch: {
    view: 'side', anchor: 'feet', hold: true, props: ['wall-front'],
    a: { lShFlex: 70, lElbow: 10, rShFlex: -40, rShAbd: 5, rHipFlex: -8, rKnee: 150 },
    b: { lShFlex: 70, lElbow: 10, rShFlex: -42, rShAbd: 5, rHipFlex: -10, rKnee: 152, spine: -2 },
  },
  hamstring: {
    view: 'side', anchor: 'feet', track: 'head', period: 4,
    a: { lKnee: 10, rKnee: 10, lShAbd: 5, rShAbd: 5 },
    b: { lHipFlex: 70, rHipFlex: 70, lKnee: 14, rKnee: 14, spine: 25, lShFlex: 80, rShFlex: 80 },
  },
  seatedFold: {
    view: 'side', anchor: 'pelvis', track: 'lHand', props: ['mat'], period: 4,
    a: { lHipFlex: 90, rHipFlex: 90, spine: 5, lShFlex: 100, rShFlex: 100 },
    b: { lHipFlex: 90, rHipFlex: 90, spine: 48, neck: 10, lShFlex: 110, rShFlex: 110 },
  },
  balance: {
    view: 'three', anchor: 'feet', hold: true,
    a: { rHipFlex: 50, rKnee: 70, lShAbd: 55, rShAbd: 55 },
    b: { rHipFlex: 52, rKnee: 72, lShAbd: 58, rShAbd: 52, roll: 1 },
  },
  calfRaise: {
    view: 'side', anchor: 'feet', track: 'head',
    a: { ...STAND },
    b: { ...STAND, lAnkle: 40, rAnkle: 40 },
  },
  calfStretch: {
    view: 'side', anchor: 'feet', hold: true, props: ['wall-front'],
    a: { pitch: 14, lShFlex: 92, rShFlex: 92, lHipFlex: 25, lKnee: 30, rHipFlex: -20 },
    b: { pitch: 15, lShFlex: 93, rShFlex: 93, lHipFlex: 26, lKnee: 31, rHipFlex: -21 },
  },
  armsUp: {
    view: 'three', anchor: 'feet', track: 'lHand',
    a: { ...STAND },
    b: { lShFlex: 175, rShFlex: 175, lElbow: 5, rElbow: 5 },
  },
  press: {
    view: 'three', anchor: 'feet', track: 'lHand', props: ['bottles'],
    a: { lShFlex: 90, rShFlex: 90, lShAbd: 30, rShAbd: 30, lElbow: 95, rElbow: 95 },
    b: { lShFlex: 172, rShFlex: 172, lShAbd: 12, rShAbd: 12, lElbow: 8, rElbow: 8 },
  },
  curl: {
    view: 'side', anchor: 'feet', track: 'lHand', props: ['bottles'],
    a: { lShFlex: 5, rShFlex: 5, lElbow: 5, rElbow: 5 },
    b: { lShFlex: 12, rShFlex: 12, lElbow: 135, rElbow: 135 },
  },
  row: {
    view: 'side', anchor: 'feet', track: 'lHand', props: ['bottles'],
    a: { spine: 42, lHipFlex: 30, rHipFlex: 30, lKnee: 25, rKnee: 25, lShFlex: 42, rShFlex: 42 },
    b: { spine: 42, lHipFlex: 30, rHipFlex: 30, lKnee: 25, rKnee: 25, lShFlex: -35, rShFlex: -35, lElbow: 77, rElbow: 77 },
  },
  dip: {
    // mãos no assento atrás; desce dobrando os cotovelos (antebraço na vertical)
    view: 'side', anchor: 'hands', track: 'pelvis', props: ['chair'],
    a: { lHipFlex: 85, rHipFlex: 85, lKnee: 85, rKnee: 85, lShFlex: -32, rShFlex: -32 },
    b: { lHipFlex: 72, rHipFlex: 72, lKnee: 98, rKnee: 98, lShFlex: -62, rShFlex: -62, lElbow: 62, rElbow: 62 },
  },
  kickback: {
    view: 'side', anchor: 'feet', track: 'rFoot', props: ['wall-front'],
    a: { pitch: 10, lShFlex: 85, rShFlex: 85 },
    b: { pitch: 18, lShFlex: 85, rShFlex: 85, rHipFlex: -35, rKnee: 15 },
  },
  childPose: {
    view: 'side', anchor: 'knees', hold: true, props: ['mat'],
    a: { pitch: 90, lHipFlex: 150, rHipFlex: 150, lKnee: 160, rKnee: 160, lShFlex: 175, rShFlex: 175, spine: 10, neck: 10 },
    b: { pitch: 88, lHipFlex: 150, rHipFlex: 150, lKnee: 160, rKnee: 160, lShFlex: 176, rShFlex: 176, spine: 12, neck: 10 },
  },
  chestOpen: {
    view: 'three', anchor: 'feet', track: 'lHand', period: 4,
    a: { ...STAND },
    b: { lShFlex: -45, rShFlex: -45, lShAbd: 20, rShAbd: 20, spine: -8, neck: -8 },
  },
  wallChest: {
    view: 'three', anchor: 'feet', hold: true, props: ['wall-front'],
    a: { lShAbd: 90, lElbow: 90, lShFlex: 0, twist: -15 },
    b: { lShAbd: 90, lElbow: 90, lShFlex: -2, twist: -18 },
  },
  tricepStretch: {
    view: 'three', anchor: 'feet', hold: true,
    a: { lShFlex: 170, lElbow: 150, rShFlex: 150, rShAbd: 10, rElbow: 60 },
    b: { lShFlex: 172, lElbow: 152, rShFlex: 152, rShAbd: 10, rElbow: 62 },
  },
  downDog: {
    view: 'side', anchor: 'hands', hold: true, props: ['mat'],
    a: { pitch: 125, lShFlex: 175, rShFlex: 175, lHipFlex: 100, rHipFlex: 100 },
    b: { pitch: 124, lShFlex: 176, rShFlex: 176, lHipFlex: 102, rHipFlex: 102 },
  },
  cobra: {
    view: 'side', anchor: 'pelvis', track: 'head', props: ['mat'], period: 4,
    a: { ...PRONE, lShFlex: 60, rShFlex: 60, lElbow: 110, rElbow: 110 },
    b: { pitch: 90, spine: -40, neck: -15, lShFlex: 70, rShFlex: 70, lElbow: 20, rElbow: 20 },
  },
  glutesStretch: {
    view: 'side', anchor: 'pelvis', hold: true, props: ['mat'],
    a: { pitch: -90, lHipFlex: 100, lKnee: 100, lHipAbd: 25, rHipFlex: 95, rKnee: 95, lShFlex: 70, rShFlex: 70, lElbow: 60, rElbow: 60 },
    b: { pitch: -90, lHipFlex: 104, lKnee: 100, lHipAbd: 25, rHipFlex: 99, rKnee: 95, lShFlex: 72, rShFlex: 72, lElbow: 60, rElbow: 60 },
  },
  hipFlexor: {
    view: 'side', anchor: 'knees', hold: true, props: ['mat'],
    a: { lHipFlex: 85, lKnee: 85, rHipFlex: -25, rKnee: 95, lShAbd: 10, rShAbd: 10 },
    b: { lHipFlex: 88, lKnee: 88, rHipFlex: -28, rKnee: 95, lShAbd: 10, rShAbd: 10, spine: -3 },
  },
  breathing: {
    view: 'side', anchor: 'pelvis', hold: true, props: ['mat'], period: 6,
    a: { ...SUPINE_KNEES, lShFlex: 20, rShFlex: 20, lElbow: 90, rElbow: 90 },
    b: { ...SUPINE_KNEES, lShFlex: 22, rShFlex: 22, lElbow: 90, rElbow: 90, spine: -4 },
  },
}

/** Exercício (slug) → família. Os não listados caem na regra por palavras. */
const BY_SLUG: Record<string, string> = {
  'agachamento-livre': 'squat',
  'agachamento-com-bracos': 'squat',
  'agachamento-com-garrafa': 'squat',
  'agachamento-sumo': 'sumo',
  'agachamento-na-parede': 'wallsit',
  afundo: 'lunge',
  'afundo-para-tras': 'lunge',
  'subida-no-degrau': 'stepup',
  'elevacao-de-quadril': 'bridge',
  'ponte-unilateral': 'bridgeOne',
  prancha: 'plank',
  'prancha-alta': 'highPlank',
  'prancha-toque-no-ombro': 'shoulderTap',
  'escalador-lento': 'climber',
  'abdominal-curto': 'crunch',
  'abdominal-infra': 'reverseCrunch',
  'elevacao-de-pernas-deitada': 'legRaise',
  'bicicleta-no-ar': 'bicycle',
  'dead-bug': 'deadBug',
  'joelhos-ao-peito': 'kneesToChest',
  'flexao-no-joelho': 'kneePushup',
  'flexao-na-parede': 'wallPushup',
  'flexao-inclinada-na-cadeira': 'inclinePushup',
  'marcha-no-lugar': 'march',
  'caminhada-calcanhar-ponta': 'heelToe',
  'elevacao-de-perna-quatro-apoios': 'quadLeg',
  superman: 'superman',
  nadador: 'swimmer',
  'cachorro-passaro': 'birdDog',
  'sentar-e-levantar': 'sitStand',
  'gato-e-vaca': 'catCow',
  'alongamento-de-quadriceps': 'quadStretch',
  'alongamento-posterior': 'hamstring',
  'alongamento-posterior-sentada': 'seatedFold',
  'equilibrio-em-uma-perna': 'balance',
  'elevacao-de-calcanhares': 'calfRaise',
  'alongamento-de-panturrilha': 'calfStretch',
  'elevacao-de-bracos': 'armsUp',
  'desenvolvimento-com-garrafas': 'press',
  'rosca-com-garrafas': 'curl',
  'remada-com-garrafas': 'row',
  'triceps-na-cadeira': 'dip',
  'chute-para-tras-em-pe': 'kickback',
  'posicao-da-crianca': 'childPose',
  'abertura-de-peito': 'chestOpen',
  'alongamento-de-peitoral-na-parede': 'wallChest',
  'alongamento-de-triceps': 'tricepStretch',
  'cachorro-olhando-para-baixo': 'downDog',
  cobra: 'cobra',
  'alongamento-de-gluteo-deitada': 'glutesStretch',
  'alongamento-de-quadril-ajoelhada': 'hipFlexor',
  'respiracao-na-barriga': 'breathing',
}

const KEYWORDS: [RegExp, string][] = [
  [/agachamento/, 'squat'],
  [/afundo/, 'lunge'],
  [/ponte|quadril/, 'bridge'],
  [/prancha/, 'plank'],
  [/abdominal|bola/, 'crunch'],
  [/flexao/, 'kneePushup'],
  [/remada/, 'row'],
  [/rosca/, 'curl'],
  [/desenvolvimento|ombro/, 'press'],
  [/chute/, 'kickback'],
  [/panturrilha|calcanhar/, 'calfRaise'],
  [/posterior|bom-dia/, 'hamstring'],
  [/peito|peitoral/, 'chestOpen'],
  [/triceps/, 'tricepStretch'],
  [/lateral/, 'armsUp'],
  [/alongamento/, 'armsUp'],
]

export function motionFor(slug: string): { family: string; motion: Motion } {
  const family = BY_SLUG[slug] ?? KEYWORDS.find(([re]) => re.test(slug))?.[1] ?? 'armsUp'
  return { family, motion: FAMILIES[family] }
}

/** Mistura duas poses (0 = A, 1 = B). */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Joint>
  for (const k of keys) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t
  return out
}

const smooth = (x: number) => x * x * (3 - 2 * x)

/**
 * Fase da execução no ciclo (0..1 → 0..1..0): segura no início, desce/sobe
 * (desenvolvimento), segura no fim e volta. Isométricos só respiram.
 */
export function cycleMix(phase: number, hold = false): number {
  const p = ((phase % 1) + 1) % 1
  if (hold) return 0.5 - 0.5 * Math.cos(p * Math.PI * 2)
  if (p < 0.12) return 0
  if (p < 0.48) return smooth((p - 0.12) / 0.36)
  if (p < 0.6) return 1
  if (p < 0.94) return 1 - smooth((p - 0.6) / 0.34)
  return 0
}
