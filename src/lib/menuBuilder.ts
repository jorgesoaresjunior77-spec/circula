// CRIE SEU CARDÁPIO — motor de montagem. Contas puras, sem banco e sem IA:
// escolhe entre as receitas PUBLICADAS da biblioteca que têm ficha do cardápio
// (recipe_menu_meta). Nunca inventa receita. Mesmos dados + mesmo `variant`
// dão sempre o mesmo cardápio (nada de sorteio); `variant` só gira a escolha
// para o botão "outra sugestão".

import { consolidateDrafts, ingredientsToDrafts, nameKey, parseIngredientLine, strip } from './shopping'
import type { DraftItem } from './shopping'

// ------------------------------------------------------------ vocabulário

export type Course =
  | 'bebida_boas_vindas'
  | 'entrada'
  | 'prato_principal'
  | 'acompanhamento'
  | 'sobremesa'
  | 'bebida_acompanhar'
  | 'cafe_finalizacao'

export const COURSES: { key: Course; label: string; hint: string; singular: string }[] = [
  { key: 'bebida_boas_vindas', label: 'Bebidas de boas-vindas', hint: 'Sugestões de bebidas para receber os convidados.', singular: 'Bebida de boas-vindas' },
  { key: 'entrada', label: 'Entrada e aperitivos', hint: 'Pequenas preparações para iniciar a experiência.', singular: 'Entrada' },
  { key: 'prato_principal', label: 'Prato principal', hint: 'A refeição principal do encontro.', singular: 'Prato principal' },
  { key: 'acompanhamento', label: 'Acompanhamentos', hint: 'Preparações que complementam o prato principal.', singular: 'Acompanhamento' },
  { key: 'sobremesa', label: 'Sobremesas', hint: 'Opções doces para finalizar.', singular: 'Sobremesa' },
  { key: 'bebida_acompanhar', label: 'Bebidas para acompanhar', hint: 'Bebidas que harmonizem com a refeição.', singular: 'Bebida para acompanhar' },
  { key: 'cafe_finalizacao', label: 'Café e finalização', hint: 'Sugestões para encerrar o encontro.', singular: 'Café e finalização' },
]

export const courseLabel = (k: string): string => COURSES.find((c) => c.key === k)?.label ?? k

export const OCCASIONS = [
  'Almoço em família',
  'Jantar especial',
  'Encontro entre amigas',
  'Aniversário',
  'Almoço de domingo',
  'Jantar romântico',
  'Café da tarde',
  'Churrasco',
  'Celebração especial',
  'Outra ocasião',
] as const

export const CUISINES = [
  { key: 'brasileira', label: 'Brasileira' },
  { key: 'italiana', label: 'Italiana' },
  { key: 'mediterranea', label: 'Mediterrânea' },
  { key: 'contemporanea', label: 'Contemporânea' },
  { key: 'caseira', label: 'Caseira' },
  { key: 'saudavel', label: 'Saudável' },
  { key: 'sofisticada', label: 'Sofisticada' },
  { key: 'pratica', label: 'Prática' },
] as const

export type CuisineKey = (typeof CUISINES)[number]['key']

/** Restrições que a nutricionista marca na ficha da receita (verificadas por ela). */
export const DIETS = [
  { key: 'sem_gluten', label: 'Sem glúten' },
  { key: 'sem_lactose', label: 'Sem lactose' },
  { key: 'sem_acucar', label: 'Sem açúcar adicionado' },
  { key: 'vegetariano', label: 'Vegetariano' },
  { key: 'vegano', label: 'Vegano' },
  { key: 'low_carb', label: 'Low carb' },
  { key: 'sem_frutos_do_mar', label: 'Sem frutos do mar' },
] as const

export type DietKey = (typeof DIETS)[number]['key']

export const dietLabel = (k: string): string => DIETS.find((d) => d.key === k)?.label ?? k

/** Alergênicos que a ficha da receita pode declarar. */
export const ALLERGENS = [
  { key: 'gluten', label: 'Glúten' },
  { key: 'leite', label: 'Leite e derivados' },
  { key: 'ovo', label: 'Ovo' },
  { key: 'amendoim', label: 'Amendoim' },
  { key: 'castanhas', label: 'Castanhas e nozes' },
  { key: 'soja', label: 'Soja' },
  { key: 'peixe', label: 'Peixe' },
  { key: 'crustaceos', label: 'Crustáceos e frutos do mar' },
  { key: 'gergelim', label: 'Gergelim' },
] as const

export const DIFFICULTIES = [
  { key: 'facil', label: 'Fácil', rank: 1 },
  { key: 'intermediario', label: 'Intermediário', rank: 2 },
  { key: 'elaborado', label: 'Elaborado', rank: 3 },
] as const

export type Difficulty = (typeof DIFFICULTIES)[number]['key']
export const difficultyLabel = (k: string | null): string => DIFFICULTIES.find((d) => d.key === k)?.label ?? '—'
const rankOf = (k: string | null): number => DIFFICULTIES.find((d) => d.key === k)?.rank ?? 0

export const TIME_OPTIONS = [
  { key: '60', label: 'Até 1 hora', minutes: 60 },
  { key: '120', label: 'Até 2 horas', minutes: 120 },
  { key: '180', label: 'Até 3 horas', minutes: 180 },
  { key: 'none', label: 'Sem limite', minutes: null },
] as const

// ------------------------------------------------------------------ dados

export interface RecipeMenuMeta {
  course: Course
  cuisines: string[]
  diets: string[]
  allergens: string[]
  allergens_verified: boolean
  prep_minutes: number | null
  difficulty: Difficulty | null
  servings: number | null
  est_cost_cents: number | null
}

export interface MenuRecipe {
  id: string
  title: string
  summary: string | null
  ingredients: string | null
  body: string | null
  cover_image_url: string | null
  status: string
  meta: RecipeMenuMeta | null
}

export interface MenuAnswers {
  name: string
  guests: number
  date: string
  time: string
  occasion: string
  courses: Course[]
  cuisines: CuisineKey[]
  diets: DietKey[]
  /** Ingredientes que a pessoa prefere não usar (texto livre, separado por vírgula). */
  avoid: string
  /** Alergias (texto livre, separado por vírgula): restrição OBRIGATÓRIA. */
  allergies: string
  timeLimit: (typeof TIME_OPTIONS)[number]['key']
  maxDifficulty: Difficulty | null
  budgetReais: number | null
  noBudgetLimit: boolean
}

export const EMPTY_ANSWERS: MenuAnswers = {
  name: '',
  guests: 4,
  date: '',
  time: '',
  occasion: '',
  courses: ['prato_principal', 'acompanhamento', 'sobremesa'],
  cuisines: [],
  diets: [],
  avoid: '',
  allergies: '',
  timeLimit: 'none',
  maxDifficulty: null,
  budgetReais: null,
  noBudgetLimit: true,
}

export interface MenuPick {
  recipe: MenuRecipe & { meta: RecipeMenuMeta }
  /** guests / rendimento da receita: quanto multiplicar os ingredientes. */
  factor: number
  /** Ingredientes já ajustados ao número de convidados. */
  scaled: DraftItem[]
  /** Observações sobre a escolha (ex.: sem receita do estilo pedido). */
  notes: string[]
}

export interface MenuSection {
  course: Course
  picks: MenuPick[]
}

export interface MenuGap {
  course: Course
  reason: string
  suggestion: string
}

export interface MenuResult {
  sections: MenuSection[]
  gaps: MenuGap[]
  /** Avisos gerais (alergias, receitas sem rendimento etc.). */
  warnings: string[]
}

// ------------------------------------------------------------- utilidades

const ORDER: Course[] = [
  'prato_principal',
  'acompanhamento',
  'entrada',
  'sobremesa',
  'bebida_boas_vindas',
  'bebida_acompanhar',
  'cafe_finalizacao',
]

/** Quantas receitas de cada etapa, conforme o tamanho do grupo. */
export function countFor(course: Course, guests: number): number {
  if (course === 'acompanhamento') return guests >= 6 ? 3 : 2
  if (course === 'entrada') return guests >= 8 ? 2 : 1
  return 1
}

/** Separa um campo livre ("cebola, alho; amendoim") em termos limpos. */
export function splitTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((t) => strip(t))
    .filter((t) => t.length > 1)
}

// Ingredientes de despensa não contam como "repetição" entre as receitas.
const STAPLES = new Set(['sal', 'pimenta', 'agua', 'azeite', 'oleo', 'acucar', 'pimenta do reino', 'sal a gosto'])

function ingredientKeys(text: string | null): Set<string> {
  const keys = new Set<string>()
  for (const line of (text ?? '').split(/\r?\n/)) {
    const p = parseIngredientLine(line)
    if (!p) continue
    const k = nameKey(p.name.replace(/\(.*?\)/g, '').trim())
    if (k && !STAPLES.has(k)) keys.add(k)
  }
  return keys
}

/** O texto contém o termo como palavra (sem acento, ignorando plural simples). */
export function mentions(text: string | null | undefined, term: string): boolean {
  const t = nameKey(text ?? '')
  const q = nameKey(term)
  if (!q) return false
  return new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?([^a-z0-9]|$)`).test(t)
}

const ALLERGEN_ALIASES: Record<string, string[]> = {
  gluten: ['gluten', 'trigo'],
  leite: ['leite', 'lactose', 'laticinio', 'queijo', 'manteiga'],
  ovo: ['ovo'],
  amendoim: ['amendoim'],
  castanhas: ['castanha', 'noz', 'nozes', 'amendoa', 'avela', 'pistache', 'oleaginosa'],
  soja: ['soja'],
  peixe: ['peixe'],
  crustaceos: ['camarao', 'crustaceo', 'fruto do mar', 'frutos do mar', 'lagosta', 'siri', 'caranguejo'],
  gergelim: ['gergelim', 'tahine'],
}

/** A alergia pedida bate com algum alergênico declarado na ficha? */
function allergenDeclared(allergen: string, term: string): boolean {
  const names = [allergen, ...(ALLERGEN_ALIASES[allergen] ?? [])]
  return names.some((n) => nameKey(n) === nameKey(term) || mentions(term, n) || mentions(n, term))
}

// ----------------------------------------------------------------- filtros

type Eligible = MenuRecipe & { meta: RecipeMenuMeta }

export interface Exclusions {
  notPublished: number
  noSheet: number
  diet: number
  avoid: number
  allergy: number
  difficulty: number
  time: number
}

function eligibleFor(r: MenuRecipe, a: MenuAnswers): { ok: boolean; reason: keyof Exclusions | null } {
  if (r.status !== 'published') return { ok: false, reason: 'notPublished' }
  if (!r.meta) return { ok: false, reason: 'noSheet' }
  const m = r.meta

  // Restrições alimentares: a receita precisa ter a marca verificada. "Vegano" também serve a quem pede vegetariano.
  for (const d of a.diets) {
    const has = m.diets.includes(d) || (d === 'vegetariano' && m.diets.includes('vegano'))
    if (!has) return { ok: false, reason: 'diet' }
  }

  // Ingredientes que a pessoa prefere não usar: fora se aparecem na lista da receita.
  for (const term of splitTerms(a.avoid)) {
    if (mentions(r.ingredients, term) || mentions(r.title, term)) return { ok: false, reason: 'avoid' }
  }

  // Alergia é obrigatória: só entra receita com ficha verificada pela nutricionista, sem o alergênico
  // declarado e sem o termo nos ingredientes. Ausência de ingrediente no texto NÃO prova segurança.
  const allergies = splitTerms(a.allergies)
  if (allergies.length > 0) {
    if (!m.allergens_verified) return { ok: false, reason: 'allergy' }
    for (const term of allergies) {
      if (m.allergens.some((al) => allergenDeclared(al, term))) return { ok: false, reason: 'allergy' }
      if (mentions(r.ingredients, term) || mentions(r.title, term)) return { ok: false, reason: 'allergy' }
    }
  }

  const max = rankOf(a.maxDifficulty)
  if (max > 0 && rankOf(m.difficulty) > max) return { ok: false, reason: 'difficulty' }

  const limit = TIME_OPTIONS.find((t) => t.key === a.timeLimit)?.minutes ?? null
  if (limit != null && m.prep_minutes != null && m.prep_minutes > limit) return { ok: false, reason: 'time' }

  return { ok: true, reason: null }
}

// ------------------------------------------------------------------ motor

export function buildMenu(answers: MenuAnswers, library: MenuRecipe[], variant = 0): MenuResult {
  const guests = Math.max(1, Math.round(answers.guests || 1))
  const warnings: string[] = []
  const sections: MenuSection[] = []
  const gaps: MenuGap[] = []
  const chosenKeys = new Set<string>()
  const chosenIds = new Set<string>()
  let mainCuisines: string[] = []
  let minutesUsed = 0
  let costUsed = 0

  const timeLimit = TIME_OPTIONS.find((t) => t.key === answers.timeLimit)?.minutes ?? null
  const budgetCents = !answers.noBudgetLimit && answers.budgetReais && answers.budgetReais > 0 ? Math.round(answers.budgetReais * 100) : null

  if (splitTerms(answers.allergies).length > 0) {
    warnings.push(
      'Alergias: só entram receitas cuja ficha foi verificada pela nutricionista. Mesmo assim, confira os rótulos dos produtos e o risco de contaminação cruzada antes de servir.',
    )
  }

  const wanted = ORDER.filter((c) => answers.courses.includes(c))

  for (const course of wanted) {
    const need = countFor(course, guests)
    const all = library.filter((r) => r.meta?.course === course)
    const counts: Exclusions = { notPublished: 0, noSheet: 0, diet: 0, avoid: 0, allergy: 0, difficulty: 0, time: 0 }
    const pool: Eligible[] = []
    for (const r of all) {
      const v = eligibleFor(r, answers)
      if (v.ok) pool.push(r as Eligible)
      else if (v.reason) counts[v.reason] += 1
    }

    const picks: MenuPick[] = []
    for (let slot = 0; slot < need; slot++) {
      const candidates = pool.filter((r) => !chosenIds.has(r.id))
      // Estilo: quem combina vem na frente; sem combinação, ainda serve (com aviso).
      const wantsStyle = answers.cuisines.length > 0
      const scored = candidates
        .map((r) => {
          const keys = ingredientKeys(r.ingredients)
          let score = 0
          const matchesStyle = !wantsStyle || r.meta.cuisines.some((c) => (answers.cuisines as string[]).includes(c))
          if (wantsStyle && matchesStyle) score += 6
          // Harmonia: combina com o estilo do prato principal já escolhido.
          if (course !== 'prato_principal' && mainCuisines.length > 0 && r.meta.cuisines.some((c) => mainCuisines.includes(c))) score += 3
          // Evita repetir ingredientes que já aparecem em outras receitas do cardápio.
          let repeated = 0
          for (const k of keys) if (chosenKeys.has(k)) repeated += 1
          score -= repeated * 1.5
          // Receita com dados completos é mais previsível para quem cozinha.
          if (r.meta.servings) score += 0.5
          if (r.meta.prep_minutes) score += 0.25
          return { r, score, matchesStyle }
        })
        .filter(({ r }) => {
          // Tempo e orçamento acumulados do cardápio inteiro.
          const mins = r.meta.prep_minutes ?? 0
          if (timeLimit != null && minutesUsed + mins > timeLimit) return false
          if (budgetCents != null && r.meta.est_cost_cents != null && r.meta.servings) {
            const cost = Math.round((r.meta.est_cost_cents * guests) / r.meta.servings)
            if (costUsed + cost > budgetCents) return false
          }
          return true
        })
        .sort((x, y) => y.score - x.score || x.r.title.localeCompare(y.r.title, 'pt-BR'))

      if (scored.length === 0) break
      const top = scored.slice(0, Math.min(scored.length, 3))
      const chosen = top[(variant + slot) % top.length]
      const r = chosen.r
      const factor = r.meta.servings ? guests / r.meta.servings : 1
      const notes: string[] = []
      if (!r.meta.servings) notes.push('A receita não informa o rendimento: as quantidades estão como cadastradas.')
      if (answers.cuisines.length > 0 && !chosen.matchesStyle) notes.push('Sem receita do estilo escolhido nesta etapa; esta é a opção compatível mais próxima.')
      picks.push({
        recipe: r,
        factor,
        scaled: ingredientsToDrafts(r.ingredients, factor, { id: r.id, title: r.title }),
        notes,
      })
      chosenIds.add(r.id)
      for (const k of ingredientKeys(r.ingredients)) chosenKeys.add(k)
      minutesUsed += r.meta.prep_minutes ?? 0
      if (r.meta.est_cost_cents != null && r.meta.servings) costUsed += Math.round((r.meta.est_cost_cents * guests) / r.meta.servings)
      if (course === 'prato_principal') mainCuisines = r.meta.cuisines
    }

    if (picks.length > 0) sections.push({ course, picks })
    if (picks.length < need) {
      gaps.push(gapFor(course, need, picks.length, all.length, counts, pool.length))
    }
  }

  // Mantém a ordem da refeição (e não a ordem de escolha do motor).
  const meal: Course[] = COURSES.map((c) => c.key)
  sections.sort((a, b) => meal.indexOf(a.course) - meal.indexOf(b.course))
  return { sections, gaps, warnings }
}

function gapFor(course: Course, need: number, got: number, total: number, ex: Exclusions, eligible: number): MenuGap {
  const label = courseLabel(course).toLowerCase()
  if (total === 0) {
    return {
      course,
      reason: `A biblioteca ainda não tem receitas de ${label} com ficha do cardápio.`,
      suggestion: 'Essa etapa fica de fora por enquanto. Assim que a nutricionista cadastrar receitas dessa categoria, elas passam a aparecer aqui.',
    }
  }
  if (eligible === 0) {
    const causes: string[] = []
    if (ex.allergy) causes.push('alergias')
    if (ex.diet) causes.push('restrições alimentares')
    if (ex.avoid) causes.push('ingredientes que você prefere não usar')
    if (ex.difficulty) causes.push('o nível de dificuldade')
    if (ex.time) causes.push('o tempo disponível')
    return {
      course,
      reason: `Nenhuma receita de ${label} atende ${causes.length ? causes.join(', ') : 'às suas escolhas'}.`,
      suggestion: 'Tente flexibilizar um critério (como o tempo, a dificuldade ou um ingrediente) ou deixe essa etapa de fora. Alergias nunca são flexibilizadas.',
    }
  }
  return {
    course,
    reason: `Só encontramos ${got} de ${need} receitas de ${label} compatíveis com o seu tempo, orçamento e escolhas.`,
    suggestion: 'O cardápio segue com o que combina. Aumentar o tempo ou o orçamento libera mais opções.',
  }
}

// ---------------------------------------------------------- lista de compras

/** Soma os ingredientes de todas as receitas do cardápio, já ajustados ao número de convidados. */
export function shoppingForMenu(result: MenuResult): DraftItem[] {
  const all: DraftItem[] = []
  for (const s of result.sections) for (const p of s.picks) all.push(...p.scaled)
  return consolidateDrafts(all)
}

export function totalMinutes(result: MenuResult): number {
  return result.sections.reduce((n, s) => n + s.picks.reduce((m, p) => m + (p.recipe.meta.prep_minutes ?? 0), 0), 0)
}
