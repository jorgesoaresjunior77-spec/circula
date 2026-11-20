// Composição corporal por PROTOCOLOS PUBLICADOS (fórmulas de livro/artigo), sem
// inteligência artificial: a nutricionista mede (dobras cutâneas ou
// circunferências) e o app aplica a equação escolhida. Todo número vem de uma
// fonte citada abaixo; o resultado é uma ESTIMATIVA, não um diagnóstico.
//
// Fontes:
//  · Siri WE (1961). Body composition from fluid spaces and density. In: Brozek J, Henschel A (eds),
//    Techniques for Measuring Body Composition. Washington: National Academy of Sciences. 223-244.
//  · Jackson AS, Pollock ML (1978). Generalized equations for predicting body density of men.
//    Br J Nutr 40:497-504.
//  · Jackson AS, Pollock ML, Ward A (1980). Generalized equations for predicting body density of women.
//    Med Sci Sports Exerc 12:175-182.
//  · Durnin JVGA, Womersley J (1974). Body fat assessed from total body density and its estimation from
//    skinfold thickness: measurements on 481 men and women aged 16 to 72 years. Br J Nutr 32:77-97.
//  · Hodgdon JA, Beckett MB (1984). Prediction of percent body fat for U.S. Navy women/men from body
//    circumferences and height. Naval Health Research Center, relatórios 84-29 (mulheres) e 84-11 (homens).
//  · Classificação do % de gordura: American Council on Exercise (ACE), tabela de categorias.
//  · Cintura e relação cintura/quadril: OMS, "Waist circumference and waist-hip ratio: report of a WHO
//    expert consultation" (Genebra, 2008; publ. 2011); cintura de 80 cm também adotada pela IDF.
//  · IMC: OMS.

export type Sex = 'F' | 'M'

export type ProtocolKey = 'jp3' | 'jp7' | 'dw4' | 'navy'

export interface Protocol {
  key: ProtocolKey
  label: string
  /** Dobras (mm) que o protocolo usa, por sexo; vazio = só circunferências. */
  skinfolds: Record<Sex, string[]>
  /** Circunferências (cm) usadas, por sexo. */
  circumferences: Record<Sex, string[]>
  /** Faixa de idade em que a equação foi validada (aviso fora dela). */
  ageRange: [number, number]
  source: string
}

export const SKINFOLD_LABEL: Record<string, string> = {
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  subescapular: 'Subescapular',
  suprailiaca: 'Suprailíaca',
  abdominal: 'Abdominal',
  coxa: 'Coxa',
  peitoral: 'Peitoral',
  axilar: 'Axilar média',
}

export const CIRCUMFERENCE_LABEL: Record<string, string> = {
  pescoco: 'Pescoço',
  cintura: 'Cintura',
  abdomen: 'Abdômen (altura do umbigo)',
  quadril: 'Quadril',
}

export const PROTOCOLS: Protocol[] = [
  {
    key: 'jp3',
    label: 'Jackson & Pollock — 3 dobras',
    skinfolds: { F: ['triceps', 'suprailiaca', 'coxa'], M: ['peitoral', 'abdominal', 'coxa'] },
    circumferences: { F: [], M: [] },
    ageRange: [18, 55],
    source: 'Jackson & Pollock (1978, homens); Jackson, Pollock & Ward (1980, mulheres). Densidade convertida pela equação de Siri (1961).',
  },
  {
    key: 'jp7',
    label: 'Jackson & Pollock — 7 dobras',
    skinfolds: {
      F: ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
      M: ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    },
    circumferences: { F: [], M: [] },
    ageRange: [18, 55],
    source: 'Jackson & Pollock (1978, homens); Jackson, Pollock & Ward (1980, mulheres). Densidade convertida pela equação de Siri (1961).',
  },
  {
    key: 'dw4',
    label: 'Durnin & Womersley — 4 dobras',
    skinfolds: { F: ['biceps', 'triceps', 'subescapular', 'suprailiaca'], M: ['biceps', 'triceps', 'subescapular', 'suprailiaca'] },
    circumferences: { F: [], M: [] },
    ageRange: [16, 72],
    source: 'Durnin & Womersley (1974). Densidade convertida pela equação de Siri (1961).',
  },
  {
    key: 'navy',
    label: 'Circunferências (Marinha dos EUA)',
    skinfolds: { F: [], M: [] },
    circumferences: { F: ['pescoco', 'cintura', 'quadril'], M: ['pescoco', 'abdomen'] },
    ageRange: [17, 79],
    source: 'Hodgdon & Beckett (1984), Naval Health Research Center. Usa só fita métrica e altura; é menos preciso que as dobras.',
  },
]

export function protocolByKey(key: ProtocolKey): Protocol {
  return PROTOCOLS.find((p) => p.key === key) ?? PROTOCOLS[0]
}

// ---------------------------------------------------------------------------------------
// Conversão densidade -> % de gordura (Siri, 1961):  %G = 495 / D − 450
// ---------------------------------------------------------------------------------------
export function siriBodyFat(density: number): number {
  return 495 / density - 450
}

// ---------------------------------------------------------------------------------------
// Densidade corporal (g/cm³) — Σ em milímetros, idade em anos
// ---------------------------------------------------------------------------------------
/** Jackson, Pollock & Ward (1980), mulheres, 3 dobras: tríceps + suprailíaca + coxa. */
export function densityJP3Women(sum: number, age: number): number {
  return 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age
}
/** Jackson & Pollock (1978), homens, 3 dobras: peitoral + abdominal + coxa. */
export function densityJP3Men(sum: number, age: number): number {
  return 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
}
/** Jackson, Pollock & Ward (1980), mulheres, 7 dobras. */
export function densityJP7Women(sum: number, age: number): number {
  return 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age
}
/** Jackson & Pollock (1978), homens, 7 dobras. */
export function densityJP7Men(sum: number, age: number): number {
  return 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age
}

/** Durnin & Womersley (1974): D = c − m × log10(Σ4 dobras). Coeficientes por sexo e faixa de idade. */
const DW: Record<Sex, { max: number; c: number; m: number }[]> = {
  F: [
    { max: 19, c: 1.1549, m: 0.0678 },
    { max: 29, c: 1.1599, m: 0.0717 },
    { max: 39, c: 1.1423, m: 0.0632 },
    { max: 49, c: 1.1333, m: 0.0612 },
    { max: Infinity, c: 1.1339, m: 0.0645 },
  ],
  M: [
    { max: 19, c: 1.162, m: 0.063 },
    { max: 29, c: 1.1631, m: 0.0632 },
    { max: 39, c: 1.1422, m: 0.0544 },
    { max: 49, c: 1.162, m: 0.07 },
    { max: Infinity, c: 1.1715, m: 0.0779 },
  ],
}
export function densityDurninWomersley(sum4: number, age: number, sex: Sex): number {
  const row = DW[sex].find((r) => age <= r.max) ?? DW[sex][DW[sex].length - 1]
  return row.c - row.m * Math.log10(sum4)
}

// ---------------------------------------------------------------------------------------
// Circunferências — Marinha dos EUA (Hodgdon & Beckett, 1984), medidas em cm
// ---------------------------------------------------------------------------------------
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm?: number): number | null {
  if (sex === 'F') {
    if (hipCm == null) return null
    const x = waistCm + hipCm - neckCm
    if (x <= 0) return null
    return 495 / (1.29579 - 0.35004 * Math.log10(x) + 0.221 * Math.log10(heightCm)) - 450
  }
  const x = waistCm - neckCm
  if (x <= 0) return null
  return 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(heightCm)) - 450
}

// ---------------------------------------------------------------------------------------
// Cálculo completo
// ---------------------------------------------------------------------------------------
export interface CompositionInput {
  protocol: ProtocolKey
  sex: Sex
  age: number
  weightKg: number | null
  heightCm: number | null
  /** Dobras em mm, por chave (ver SKINFOLD_LABEL). */
  skinfolds: Record<string, number | null | undefined>
  /** Circunferências em cm, por chave (ver CIRCUMFERENCE_LABEL). */
  circumferences: Record<string, number | null | undefined>
}

export interface CompositionResult {
  bodyFatPct: number
  /** Densidade corporal usada (null no protocolo de circunferências). */
  density: number | null
  fatMassKg: number | null
  leanMassKg: number | null
  warnings: string[]
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

function sumOf(keys: string[], values: Record<string, number | null | undefined>): number | null {
  let total = 0
  for (const k of keys) {
    const v = values[k]
    if (v == null || !Number.isFinite(v) || v <= 0) return null
    total += v
  }
  return total
}

/** Devolve o resultado ou null quando falta alguma medida do protocolo. */
export function computeBodyComposition(input: CompositionInput): CompositionResult | null {
  const proto = protocolByKey(input.protocol)
  const { sex, age } = input
  if (!Number.isFinite(age) || age <= 0) return null
  const warnings: string[] = []
  if (age < proto.ageRange[0] || age > proto.ageRange[1]) {
    warnings.push(`Este protocolo foi validado para ${proto.ageRange[0]} a ${proto.ageRange[1]} anos; fora dessa faixa o resultado é menos confiável.`)
  }

  let pct: number | null = null
  let density: number | null = null

  if (proto.key === 'navy') {
    if (!input.heightCm) return null
    const neck = input.circumferences.pescoco
    const waist = sex === 'F' ? input.circumferences.cintura : input.circumferences.abdomen
    const hip = input.circumferences.quadril
    if (!neck || !waist || (sex === 'F' && !hip)) return null
    pct = navyBodyFat(sex, input.heightCm, neck, waist, hip ?? undefined)
    if (pct == null) return null
  } else {
    const sum = sumOf(proto.skinfolds[sex], input.skinfolds)
    if (sum == null) return null
    if (proto.key === 'jp3') density = sex === 'F' ? densityJP3Women(sum, age) : densityJP3Men(sum, age)
    else if (proto.key === 'jp7') density = sex === 'F' ? densityJP7Women(sum, age) : densityJP7Men(sum, age)
    else density = densityDurninWomersley(sum, age, sex)
    pct = siriBodyFat(density)
  }

  if (!Number.isFinite(pct) || pct <= 0 || pct >= 70) {
    warnings.push('O resultado ficou fora do esperado. Confira as medidas digitadas.')
  }
  const bodyFatPct = round(pct, 1)
  const fatMassKg = input.weightKg ? round((input.weightKg * bodyFatPct) / 100, 1) : null
  const leanMassKg = input.weightKg && fatMassKg != null ? round(input.weightKg - fatMassKg, 1) : null
  return { bodyFatPct, density: density == null ? null : round(density, 4), fatMassKg, leanMassKg, warnings }
}

// ---------------------------------------------------------------------------------------
// Classificações de referência (informativas)
// ---------------------------------------------------------------------------------------
export interface Band {
  label: string
}

/** % de gordura — categorias do American Council on Exercise (ACE). */
export function classifyBodyFat(sex: Sex, pct: number): string {
  const bands: [number, string][] =
    sex === 'F'
      ? [
          [14, 'Gordura essencial'],
          [21, 'Atlética'],
          [25, 'Em forma'],
          [32, 'Média'],
          [Infinity, 'Elevada (obesidade)'],
        ]
      : [
          [6, 'Gordura essencial'],
          [14, 'Atlético'],
          [18, 'Em forma'],
          [25, 'Médio'],
          [Infinity, 'Elevado (obesidade)'],
        ]
  return bands.find(([max]) => pct < max)![1]
}

/** Circunferência da cintura — OMS/IDF (mulheres 80 e 88 cm; homens 94 e 102 cm). */
export function classifyWaist(sex: Sex, cm: number): string {
  const [risk, high] = sex === 'F' ? [80, 88] : [94, 102]
  if (cm >= high) return 'Risco muito aumentado'
  if (cm >= risk) return 'Risco aumentado'
  return 'Sem aumento de risco'
}

/** Relação cintura/quadril — OMS (obesidade abdominal: mulheres ≥ 0,85; homens ≥ 0,90). */
export function classifyWhr(sex: Sex, ratio: number): string {
  const limit = sex === 'F' ? 0.85 : 0.9
  return ratio >= limit ? 'Acima do limite da OMS' : 'Dentro do limite da OMS'
}

/** IMC — classes da OMS. */
export function classifyBmi(value: number): string {
  if (value < 18.5) return 'Abaixo do peso'
  if (value < 25) return 'Peso normal'
  if (value < 30) return 'Sobrepeso'
  if (value < 35) return 'Obesidade grau I'
  if (value < 40) return 'Obesidade grau II'
  return 'Obesidade grau III'
}
