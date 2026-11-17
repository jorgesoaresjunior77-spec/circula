// Plano alimentar: contas puras. O banco de alimentos guarda os nutrientes de
// uma porção de referência (portion_g gramas); aqui eles viram nutrientes por
// quantidade. Alimento sem valor informado fica sem valor: nada é estimado ou
// inventado, e o total avisa quando algum item não tinha dados.

export interface Food {
  id: string
  name: string
  category: string | null
  portion_label: string | null
  portion_g: number
  kcal: number | null
  protein_g: number | null
  carb_g: number | null
  fat_g: number | null
  sat_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  source: 'propria' | 'importada'
}

export interface Nutrients {
  kcal: number
  protein: number
  carb: number
  fat: number
  fiber: number
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 }

export interface Substitution {
  id: string
  name: string
  grams: number | null
  household: string
  note: string
}

export interface PlanItem {
  id: string
  kind: 'food' | 'recipe' | 'free'
  refId: string | null
  name: string
  grams: number | null
  household: string
  portions: string
  prep: string
  note: string
  /** Nutrientes da quantidade, calculados ao salvar; null quando o item não tem dados. */
  nutrients: Nutrients | null
  substitutions: Substitution[]
}

export interface PlanMeal {
  id: string
  name: string
  time: string
  notes: string
  items: PlanItem[]
}

export interface EnergyEstimate {
  formula: string
  sex: 'F' | 'M'
  age: number
  weightKg: number
  heightCm: number
  activityFactor: number
  activityLabel: string
  bmr: number
  total: number
}

export interface Plan {
  id: string
  patient_id: string
  name: string
  objective: string | null
  start_date: string | null
  review_date: string | null
  kcal_target: number | null
  protein_g_target: number | null
  carb_g_target: number | null
  fat_g_target: number | null
  fiber_g_target: number | null
  water_ml_target: number | null
  goals: string | null
  energy_estimate: EnergyEstimate | null
  notes: string | null
  guidance: string | null
  meals: PlanMeal[]
  status: 'rascunho' | 'ativo' | 'arquivado'
  shared_with_patient: boolean
  created_at: string
}

const r1 = (n: number): number => Math.round(n * 10) / 10

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/** Nutrientes de `grams` gramas do alimento; null se o alimento não informa as calorias. */
export function nutrientsFor(food: Food, grams: number): Nutrients | null {
  if (!(grams > 0) || food.kcal == null) return null
  const k = grams / food.portion_g
  return {
    kcal: r1((food.kcal ?? 0) * k),
    protein: r1((food.protein_g ?? 0) * k),
    carb: r1((food.carb_g ?? 0) * k),
    fat: r1((food.fat_g ?? 0) * k),
    fiber: r1((food.fiber_g ?? 0) * k),
  }
}

export function sumNutrients(list: (Nutrients | null)[]): { total: Nutrients; missing: number } {
  const total = { ...ZERO }
  let missing = 0
  for (const n of list) {
    if (!n) {
      missing += 1
      continue
    }
    total.kcal += n.kcal
    total.protein += n.protein
    total.carb += n.carb
    total.fat += n.fat
    total.fiber += n.fiber
  }
  return {
    total: { kcal: r1(total.kcal), protein: r1(total.protein), carb: r1(total.carb), fat: r1(total.fat), fiber: r1(total.fiber) },
    missing,
  }
}

export function mealTotals(meal: PlanMeal) {
  return sumNutrients(meal.items.map((i) => i.nutrients))
}

export function dayTotals(meals: PlanMeal[]) {
  return sumNutrients(meals.flatMap((m) => m.items.map((i) => i.nutrients)))
}

/** Distribuição de macronutrientes pelas calorias (4/4/9 kcal por grama). Vazio sem dados. */
export function macroSplit(n: Nutrients): { protein: number; carb: number; fat: number } | null {
  const p = n.protein * 4
  const c = n.carb * 4
  const f = n.fat * 9
  const total = p + c + f
  if (total <= 0) return null
  return {
    protein: Math.round((p / total) * 100),
    carb: Math.round((c / total) * 100),
    fat: Math.round((f / total) * 100),
  }
}

/** Receita: soma dos ingredientes dividida pelo rendimento = nutrientes de uma porção. */
export function recipePerPortion(ingredients: (Nutrients | null)[], yieldPortions: number): { perPortion: Nutrients; missing: number } {
  const { total, missing } = sumNutrients(ingredients)
  const y = yieldPortions > 0 ? yieldPortions : 1
  return {
    perPortion: {
      kcal: r1(total.kcal / y),
      protein: r1(total.protein / y),
      carb: r1(total.carb / y),
      fat: r1(total.fat / y),
      fiber: r1(total.fiber / y),
    },
    missing,
  }
}

// ----------------------------------------------- estimativa de energia

export const ACTIVITY_LEVELS: { factor: number; label: string }[] = [
  { factor: 1.2, label: 'Sedentária (1,2)' },
  { factor: 1.375, label: 'Pouco ativa (1,375)' },
  { factor: 1.55, label: 'Moderadamente ativa (1,55)' },
  { factor: 1.725, label: 'Muito ativa (1,725)' },
  { factor: 1.9, label: 'Extremamente ativa (1,9)' },
]

/**
 * Estimativa pela equação de Mifflin-St Jeor (taxa metabólica basal):
 *   homem: 10·peso + 6,25·altura − 5·idade + 5
 *   mulher: 10·peso + 6,25·altura − 5·idade − 161
 * multiplicada pelo fator de atividade. É só uma estimativa para a
 * nutricionista conferir: nunca vira prescrição sozinha.
 */
export function estimateEnergy(input: {
  sex: 'F' | 'M'
  age: number
  weightKg: number
  heightCm: number
  activityFactor: number
}): EnergyEstimate | null {
  const { sex, age, weightKg, heightCm, activityFactor } = input
  if (!(age > 0) || !(weightKg > 0) || !(heightCm > 0) || !(activityFactor > 0)) return null
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'M' ? 5 : -161)
  return {
    formula: 'Mifflin-St Jeor',
    sex,
    age,
    weightKg,
    heightCm,
    activityFactor,
    activityLabel: ACTIVITY_LEVELS.find((a) => a.factor === activityFactor)?.label ?? String(activityFactor),
    bmr: Math.round(bmr),
    total: Math.round(bmr * activityFactor),
  }
}

// ------------------------------------------------------ importação CSV

export interface FoodRow {
  name: string
  category: string | null
  portion_label: string | null
  portion_g: number
  kcal: number | null
  protein_g: number | null
  carb_g: number | null
  fat_g: number | null
  sat_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
}

function parseNumber(v: string | undefined): number | null {
  if (v == null) return null
  const t = v.trim().replace(/\s/g, '')
  if (t === '' || t === '-' || t.toUpperCase() === 'NA' || t.toUpperCase() === 'TR') return null
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

const HEADERS: Record<string, keyof FoodRow> = {
  nome: 'name',
  alimento: 'name',
  categoria: 'category',
  grupo: 'category',
  medida: 'portion_label',
  'medida caseira': 'portion_label',
  porcao: 'portion_g',
  'porcao g': 'portion_g',
  gramas: 'portion_g',
  kcal: 'kcal',
  calorias: 'kcal',
  energia: 'kcal',
  proteina: 'protein_g',
  proteinas: 'protein_g',
  carboidrato: 'carb_g',
  carboidratos: 'carb_g',
  gordura: 'fat_g',
  gorduras: 'fat_g',
  lipidios: 'fat_g',
  'gordura saturada': 'sat_fat_g',
  saturada: 'sat_fat_g',
  fibra: 'fiber_g',
  fibras: 'fiber_g',
  sodio: 'sodium_mg',
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Lê um CSV de alimentos (separador ; ou ,). A primeira linha traz os nomes
 * das colunas (nome, categoria, porcao, kcal, proteina, carboidrato, gordura,
 * gordura saturada, fibra, sodio). Sem coluna de porção, assume 100 g.
 * Os valores precisam ser os da porção informada.
 */
export function parseFoodsCsv(text: string): { rows: FoodRow[]; skipped: number; error: string | null } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], skipped: 0, error: 'O arquivo precisa ter o cabeçalho e ao menos um alimento.' }
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const cols = splitLine(lines[0], sep).map((h) => HEADERS[norm(h)])
  if (!cols.includes('name')) return { rows: [], skipped: 0, error: 'Não encontrei a coluna "nome" no cabeçalho.' }
  const rows: FoodRow[] = []
  let skipped = 0
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep)
    const row: FoodRow = {
      name: '',
      category: null,
      portion_label: null,
      portion_g: 100,
      kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
      sat_fat_g: null,
      fiber_g: null,
      sodium_mg: null,
    }
    cols.forEach((key, i) => {
      if (!key) return
      const raw = cells[i]
      if (key === 'name') row.name = (raw ?? '').trim().slice(0, 200)
      else if (key === 'category' || key === 'portion_label') row[key] = (raw ?? '').trim().slice(0, 80) || null
      else if (key === 'portion_g') row.portion_g = parseNumber(raw) ?? 100
      else row[key] = parseNumber(raw)
    })
    if (!row.name || row.portion_g <= 0 || row.portion_g > 5000) {
      skipped += 1
      continue
    }
    rows.push(row)
  }
  return { rows, skipped, error: rows.length === 0 ? 'Nenhum alimento válido no arquivo.' : null }
}
