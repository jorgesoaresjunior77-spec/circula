// Gestão Nutricional — tipos e contas puras (sem banco). Os números aqui são
// só aritmética sobre o que a nutricionista digitou: nada vira diagnóstico,
// e indicadores que dependem de equipamento ou protocolo (gordura corporal,
// massa muscular...) nunca são calculados a partir de peso e altura.

export interface Patient {
  id: string
  community_id: string
  full_name: string
  photo_path: string | null
  birth_date: string | null
  sex: 'F' | 'M' | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cpf: string | null
  profession: string | null
  marital_status: string | null
  address: string | null
  notes: string | null
  main_goal: string | null
  secondary_goals: string | null
  follow_up_history: string | null
  food_preferences: string | null
  food_restrictions: string | null
  allergies: string | null
  intolerances: string | null
  status: 'ativo' | 'inativo'
  created_at: string
}

export type PatientInput = Partial<Omit<Patient, 'id' | 'community_id' | 'created_at'>> & { full_name: string }

export interface Assessment {
  id: string
  patient_id: string
  assessed_on: string
  weight_kg: number | null
  height_cm: number | null
  abdomen_cm: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  calf_cm: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  fat_mass_kg: number | null
  body_water_pct: number | null
  bone_mass_kg: number | null
  skinfolds: Record<string, number>
  custom: { name: string; value: number; unit: string }[]
  source: string | null
  notes: string | null
}

export type AssessmentInput = Partial<Omit<Assessment, 'id' | 'patient_id'>> & { assessed_on: string }

export interface Consultation {
  id: string
  patient_id: string
  kind: 'consulta' | 'retorno'
  status: 'agendada' | 'realizada' | 'cancelada'
  scheduled_on: string
  scheduled_time: string | null
  evolution: string | null
  next_return_on: string | null
}

// ---------------------------------------------------------------- datas

/** yyyy-mm-dd do dia local. */
export function isoToday(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** "17/11/2026" a partir de yyyy-mm-dd, sem passar por fuso. */
export function brDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Idade em anos completos na data `today` (null sem nascimento válido). */
export function ageFrom(birthIso: string | null | undefined, today: Date = new Date()): number | null {
  if (!birthIso) return null
  const [y, m, d] = birthIso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Dias entre duas datas yyyy-mm-dd (positivo quando a segunda é depois). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / 86_400_000)
}

// ------------------------------------------------------ medidas e razões

const round = (n: number, digits: number): number => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** IMC = peso (kg) / altura (m)². Null sem os dois valores. */
export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  return round(weightKg / (m * m), 1)
}

/** Relação cintura/quadril. */
export function waistHipRatio(waist: number | null | undefined, hip: number | null | undefined): number | null {
  if (!waist || !hip) return null
  return round(waist / hip, 2)
}

/** Relação cintura/estatura (as duas em cm). */
export function waistHeightRatio(waist: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!waist || !heightCm) return null
  return round(waist / heightCm, 2)
}

/** Diferença (atual − anterior); null quando falta um dos lados. */
export function diff(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null
  return round(current - previous, 2)
}

/** Variação percentual do valor em relação ao anterior. */
export function percentVariation(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null
  return round(((current - previous) / previous) * 100, 1)
}

/** Faixa do IMC do adulto (OMS), só como referência de leitura — não é diagnóstico. */
export function bmiRangeLabel(value: number | null): string | null {
  if (value == null) return null
  if (value < 18.5) return 'abaixo de 18,5'
  if (value < 25) return '18,5 a 24,9'
  if (value < 30) return '25 a 29,9'
  return '30 ou mais'
}

export interface MeasureDef {
  key: keyof Assessment
  label: string
  unit: string
}

/** Medidas que a nutricionista digita (as que dependem de equipamento ficam claramente separadas). */
export const BODY_MEASURES: MeasureDef[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'height_cm', label: 'Altura', unit: 'cm' },
  { key: 'abdomen_cm', label: 'Circunferência abdominal', unit: 'cm' },
  { key: 'waist_cm', label: 'Circunferência da cintura', unit: 'cm' },
  { key: 'hip_cm', label: 'Circunferência do quadril', unit: 'cm' },
  { key: 'arm_cm', label: 'Circunferência do braço', unit: 'cm' },
  { key: 'thigh_cm', label: 'Circunferência da coxa', unit: 'cm' },
  { key: 'calf_cm', label: 'Circunferência da panturrilha', unit: 'cm' },
]

export const COMPOSITION_MEASURES: MeasureDef[] = [
  { key: 'body_fat_pct', label: 'Gordura corporal', unit: '%' },
  { key: 'muscle_mass_kg', label: 'Massa muscular', unit: 'kg' },
  { key: 'fat_mass_kg', label: 'Massa de gordura', unit: 'kg' },
  { key: 'body_water_pct', label: 'Água corporal', unit: '%' },
  { key: 'bone_mass_kg', label: 'Massa óssea', unit: 'kg' },
]

export const ALL_MEASURES: MeasureDef[] = [...BODY_MEASURES, ...COMPOSITION_MEASURES]

/** Ordena da avaliação mais antiga para a mais recente. */
export function sortAssessments<T extends { assessed_on: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on))
}

/** Altura mais recente informada até a avaliação `index` (a altura pode não ser repetida a cada consulta). */
export function heightAt(sortedAsc: Assessment[], index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const h = sortedAsc[i].height_cm
    if (h) return h
  }
  return null
}

export interface AssessmentDerived {
  bmi: number | null
  whr: number | null
  whtr: number | null
}

export function derive(a: Assessment, heightCm: number | null): AssessmentDerived {
  const waist = a.waist_cm ?? null
  return {
    bmi: bmi(a.weight_kg, heightCm),
    whr: waistHipRatio(waist, a.hip_cm),
    whtr: waistHeightRatio(waist, heightCm),
  }
}

// ------------------------------------------------------------ retornos

const RETURN_AFTER_DAYS = 30

/** Precisa de retorno: tem retorno marcado já vencido, ou a última consulta feita passou de 30 dias. */
export function needsReturn(consultations: Consultation[], today: string): boolean {
  const done = consultations.filter((c) => c.status === 'realizada')
  if (done.length === 0) return false
  const scheduledAhead = consultations.some((c) => c.status === 'agendada' && c.scheduled_on >= today)
  if (scheduledAhead) return false
  const last = done.map((c) => c.scheduled_on).sort().at(-1) as string
  const marked = done.filter((c) => c.next_return_on).map((c) => c.next_return_on as string).sort().at(-1)
  if (marked) return marked < today
  return daysBetween(last, today) > RETURN_AFTER_DAYS
}
