// Minha Lista: contas puras (categorias, unidades, leitura de ingredientes de
// receita, consolidação e totais). Nada aqui conversa com o banco.
//
// Regra de ouro da consolidação: só soma o que é realmente a mesma coisa na
// mesma grandeza. Gramas com quilos somam (peso); mililitros com litros somam
// (volume); "2 ovos" com "200 g de ovo" NÃO somam (unidades incompatíveis).

export const CATEGORIES = [
  { key: 'frutas', label: 'Frutas' },
  { key: 'verduras_legumes', label: 'Verduras e legumes' },
  { key: 'carnes_aves', label: 'Carnes e aves' },
  { key: 'peixes', label: 'Peixes e frutos do mar' },
  { key: 'ovos_laticinios', label: 'Ovos e laticínios' },
  { key: 'graos_cereais', label: 'Grãos e cereais' },
  { key: 'massas_farinhas', label: 'Massas e farinhas' },
  { key: 'temperos', label: 'Temperos e condimentos' },
  { key: 'oleaginosas_sementes', label: 'Oleaginosas e sementes' },
  { key: 'bebidas', label: 'Bebidas' },
  { key: 'naturais', label: 'Produtos naturais' },
  { key: 'congelados', label: 'Congelados' },
  { key: 'despensa', label: 'Produtos de despensa' },
  { key: 'outros', label: 'Outros' },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']

export const UNITS = [
  { key: 'un', label: 'unidade', short: 'un' },
  { key: 'kg', label: 'quilograma', short: 'kg' },
  { key: 'g', label: 'grama', short: 'g' },
  { key: 'l', label: 'litro', short: 'L' },
  { key: 'ml', label: 'mililitro', short: 'ml' },
  { key: 'pacote', label: 'pacote', short: 'pct' },
  { key: 'caixa', label: 'caixa', short: 'cx' },
  { key: 'bandeja', label: 'bandeja', short: 'bdj' },
  { key: 'duzia', label: 'dúzia', short: 'dz' },
  { key: 'pote', label: 'pote', short: 'pote' },
] as const

export type UnitKey = (typeof UNITS)[number]['key']

export const categoryLabel = (k: string): string => CATEGORIES.find((c) => c.key === k)?.label ?? 'Outros'
export const unitShort = (k: string): string => UNITS.find((u) => u.key === k)?.short ?? k

export interface ListItem {
  id: string
  list_id: string
  name: string
  category: CategoryKey
  quantity: number
  unit: UnitKey
  est_price_cents: number | null
  paid_price_cents: number | null
  /** Marca (opcional): deixa a comparação de preços mais precisa. */
  brand?: string | null
  notes: string | null
  bought: boolean
  position: number
  source_recipe_id: string | null
  source_recipe_title: string | null
}

export interface ShoppingList {
  id: string
  community_id: string
  owner_id: string
  name: string
  description: string | null
  planned_for: string | null
  notes: string | null
  status: 'em_andamento' | 'concluida' | 'arquivada'
  source: 'manual' | 'receitas' | 'nutricionista' | 'duplicada'
  created_at: string
  completed_at: string | null
  /** Onde e quando a compra foi feita (preenchido ao salvar no histórico). */
  store_name?: string | null
  purchased_on?: string | null
}

export interface DraftItem {
  name: string
  category: CategoryKey
  quantity: number
  unit: UnitKey
  notes: string | null
  source_recipe_id?: string | null
  source_recipe_title?: string | null
}

// ----------------------------------------------------------------- textos

export const strip = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Chave para reconhecer o "mesmo" produto: sem acento, sem caixa e sem plural simples. */
export function nameKey(name: string): string {
  return strip(name)
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
}

const CATEGORY_WORDS: [CategoryKey, string[]][] = [
  ['frutas', ['banana', 'maca', 'laranja', 'limao', 'mamao', 'abacate', 'morango', 'uva', 'manga', 'melancia', 'abacaxi', 'pera', 'kiwi', 'goiaba', 'melao', 'fruta']],
  ['verduras_legumes', ['tomate', 'cebola', 'alho', 'cenoura', 'batata', 'abobora', 'abobrinha', 'alface', 'couve', 'brocolis', 'espinafre', 'pepino', 'pimentao', 'beterraba', 'repolho', 'mandioca', 'aipim', 'chuchu', 'berinjela', 'rucula', 'cheiro verde', 'salsinha', 'cebolinha', 'legume', 'verdura']],
  ['carnes_aves', ['frango', 'carne', 'bife', 'file', 'peito', 'coxa', 'sobrecoxa', 'linguica', 'bacon', 'presunto', 'peru', 'porco', 'acem', 'patinho', 'alcatra', 'carne moida', 'costela']],
  ['peixes', ['peixe', 'salmao', 'tilapia', 'atum', 'sardinha', 'camarao', 'bacalhau', 'merluza', 'lula', 'polvo']],
  ['ovos_laticinios', ['ovo', 'leite', 'queijo', 'iogurte', 'manteiga', 'requeijao', 'creme de leite', 'nata', 'ricota', 'mussarela', 'cottage', 'kefir']],
  ['graos_cereais', ['arroz', 'feijao', 'lentilha', 'grao de bico', 'ervilha', 'milho', 'aveia', 'quinoa', 'granola', 'cereal', 'trigo']],
  ['massas_farinhas', ['macarrao', 'massa', 'farinha', 'espaguete', 'penne', 'lasanha', 'pao', 'fermento', 'amido', 'maisena', 'tapioca', 'biscoito']],
  ['temperos', ['sal', 'pimenta', 'oregano', 'cominho', 'canela', 'colorau', 'paprica', 'louro', 'curry', 'acafrao', 'curcuma', 'manjericao', 'tempero', 'vinagre', 'molho de soja', 'shoyu']],
  ['oleaginosas_sementes', ['castanha', 'amendoa', 'nozes', 'noz', 'amendoim', 'chia', 'linhaca', 'semente', 'gergelim', 'girassol', 'pistache']],
  ['bebidas', ['suco', 'refrigerante', 'agua', 'cafe', 'cha', 'cerveja', 'vinho', 'bebida']],
  ['naturais', ['mel', 'tahine', 'cacau', 'whey', 'spirulina', 'organico', 'integral']],
  ['congelados', ['congelad', 'sorvete', 'polpa', 'hamburguer']],
  ['despensa', ['azeite', 'oleo', 'acucar', 'molho de tomate', 'extrato', 'atomatado', 'leite condensado', 'enlatad', 'conserva', 'azeitona', 'palmito', 'geleia']],
]

/** Sugere a categoria pelo nome; sem pista, "Outros". A usuária sempre pode trocar. */
export function guessCategory(name: string): CategoryKey {
  const t = ` ${strip(name)} `
  for (const [cat, words] of CATEGORY_WORDS) {
    if (words.some((w) => t.includes(` ${w}`) || t.includes(` ${w}s `) || (w.length > 6 && t.includes(w)))) return cat
  }
  return 'outros'
}

// ------------------------------------------------ ingredientes de receita

const UNIT_WORDS: Record<string, UnitKey> = {
  g: 'g', gr: 'g', grama: 'g', gramas: 'g',
  kg: 'kg', quilo: 'kg', quilos: 'kg', quilograma: 'kg', quilogramas: 'kg', kilo: 'kg', kilos: 'kg',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  un: 'un', und: 'un', unidade: 'un', unidades: 'un',
  pacote: 'pacote', pacotes: 'pacote', pct: 'pacote',
  caixa: 'caixa', caixas: 'caixa', cx: 'caixa',
  bandeja: 'bandeja', bandejas: 'bandeja',
  duzia: 'duzia', duzias: 'duzia',
  pote: 'pote', potes: 'pote',
}

// Medidas caseiras: não viram unidade do mercado; ficam anotadas no nome
// ("arroz (xícara)") para não serem somadas com gramas por engano.
const HOME_MEASURES = new Set([
  'xicara', 'xicaras', 'colher', 'colheres', 'copo', 'copos', 'pitada', 'pitadas', 'fatia', 'fatias', 'dente', 'dentes',
  'maco', 'macos', 'folha', 'folhas', 'ramo', 'ramos', 'punhado', 'lata', 'latas', 'sache', 'saches', 'talo', 'talos', 'cubo', 'cubos',
])

const SINGULAR: Record<string, string> = {
  xicaras: 'xicara', colheres: 'colher', copos: 'copo', pitadas: 'pitada', fatias: 'fatia', dentes: 'dente', macos: 'maco',
  folhas: 'folha', ramos: 'ramo', latas: 'lata', saches: 'sache', talos: 'talo', cubos: 'cubo',
}

function toNumber(raw: string): number | null {
  const t = raw.trim()
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = t.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export interface ParsedIngredient {
  name: string
  quantity: number
  unit: UnitKey
  notes: string | null
}

/**
 * Lê uma linha de ingrediente ("2 ovos", "200 g de frango", "1 1/2 xícara de
 * arroz", "sal a gosto"). Sem quantidade, vira 1 unidade com a observação
 * original. Devolve null para linha vazia.
 */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  let text = line.replace(/^\s*[-–•*]\s+/, '').trim()
  if (!text) return null
  let notes: string | null = null

  const comma = text.search(/,(?![0-9])/)
  if (comma > 0) {
    notes = text.slice(comma + 1).trim() || null
    text = text.slice(0, comma).trim()
  }
  const paren = text.match(/\(([^)]*)\)/)
  if (paren) {
    notes = [notes, paren[1].trim()].filter(Boolean).join('; ') || null
    text = text.replace(paren[0], '').replace(/\s+/g, ' ').trim()
  }

  const m = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!m) {
    const gosto = /\ba gosto\b/i.test(text)
    const name = text.replace(/\s*a gosto\s*/i, ' ').replace(/\s+/g, ' ').trim()
    return { name: name || text, quantity: 1, unit: 'un', notes: gosto ? 'a gosto' : notes ?? 'quantidade não informada' }
  }
  const quantity = toNumber(m[1])
  let rest = m[2].trim()
  if (quantity == null || quantity <= 0) return { name: text, quantity: 1, unit: 'un', notes }

  let unit: UnitKey = 'un'
  let measure: string | null = null
  const first = rest.split(/\s+/)[0] ?? ''
  const key = strip(first).replace(/\.$/, '')
  if (UNIT_WORDS[key]) {
    unit = UNIT_WORDS[key]
    rest = rest.slice(first.length).trim()
  } else if (HOME_MEASURES.has(key)) {
    measure = SINGULAR[key] ?? key
    rest = rest.slice(first.length).trim()
    // "colher de sopa", "colher (sopa)": mantém a especificação junto da medida
    const spec = rest.match(/^(?:de\s+)?(sopa|cha|sobremesa|cafe)\b\s*/i)
    if (spec) {
      measure = `${measure} de ${strip(spec[1])}`
      rest = rest.slice(spec[0].length).trim()
    }
  }
  rest = rest.replace(/^(de|do|da|dos|das)\s+/i, '').trim()
  if (!rest) return null
  const name = measure ? `${rest} (${measure})` : rest
  return { name, quantity, unit, notes }
}

/** Ingredientes de uma receita (texto, uma linha por item) em itens da lista. */
export function ingredientsToDrafts(text: string | null | undefined, factor: number, recipe: { id: string; title: string }): DraftItem[] {
  const out: DraftItem[] = []
  for (const line of (text ?? '').split(/\r?\n/)) {
    const p = parseIngredientLine(line)
    if (!p) continue
    out.push({
      name: p.name,
      category: guessCategory(p.name),
      quantity: roundQty(p.quantity * factor),
      unit: p.unit,
      notes: p.notes,
      source_recipe_id: recipe.id,
      source_recipe_title: recipe.title,
    })
  }
  return out
}

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

// --------------------------------------------------------------- consolidar

type Dim = { dim: 'peso' | 'volume'; base: 'g' | 'ml'; factor: number } | null

function dimension(unit: UnitKey): Dim {
  if (unit === 'g') return { dim: 'peso', base: 'g', factor: 1 }
  if (unit === 'kg') return { dim: 'peso', base: 'g', factor: 1000 }
  if (unit === 'ml') return { dim: 'volume', base: 'ml', factor: 1 }
  if (unit === 'l') return { dim: 'volume', base: 'ml', factor: 1000 }
  return null
}

/** Grupo de compatibilidade: mesma grandeza (peso/volume) ou a própria unidade. */
export function compatKey(name: string, unit: UnitKey): string {
  const d = dimension(unit)
  return `${nameKey(name)}|${d ? d.dim : unit}`
}

/** Soma duas quantidades compatíveis; null se as unidades não combinam. */
export function addQuantities(a: { quantity: number; unit: UnitKey }, b: { quantity: number; unit: UnitKey }): { quantity: number; unit: UnitKey } | null {
  const da = dimension(a.unit)
  const db = dimension(b.unit)
  if (da && db) {
    if (da.dim !== db.dim) return null
    const total = a.quantity * da.factor + b.quantity * db.factor
    // mantém a unidade do primeiro; sobe para kg/L quando passa de 1000
    if (da.base === 'g') return total >= 1000 ? { quantity: roundQty(total / 1000), unit: 'kg' } : { quantity: roundQty(total), unit: 'g' }
    return total >= 1000 ? { quantity: roundQty(total / 1000), unit: 'l' } : { quantity: roundQty(total), unit: 'ml' }
  }
  if (a.unit !== b.unit) return null
  return { quantity: roundQty(a.quantity + b.quantity), unit: a.unit }
}

/** Junta itens repetidos de uma lista nova (ex.: várias receitas). */
export function consolidateDrafts(drafts: DraftItem[]): DraftItem[] {
  const out: DraftItem[] = []
  const index = new Map<string, number>()
  for (const d of drafts) {
    const key = compatKey(d.name, d.unit)
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, out.length)
      out.push({ ...d })
      continue
    }
    const sum = addQuantities(out[at], d)
    if (!sum) {
      out.push({ ...d })
      continue
    }
    out[at] = {
      ...out[at],
      ...sum,
      notes: [out[at].notes, d.notes].filter((x, i, arr) => x && arr.indexOf(x) === i).join('; ') || null,
      source_recipe_id: out[at].source_recipe_id === d.source_recipe_id ? out[at].source_recipe_id : null,
      source_recipe_title:
        out[at].source_recipe_title && d.source_recipe_title && out[at].source_recipe_title !== d.source_recipe_title
          ? `${out[at].source_recipe_title} + ${d.source_recipe_title}`
          : out[at].source_recipe_title ?? d.source_recipe_title ?? null,
    }
  }
  return out
}

export interface MergePlan {
  updates: { id: string; quantity: number; unit: UnitKey; source_recipe_title: string | null }[]
  inserts: DraftItem[]
}

/** Junta itens novos a uma lista que já existe: soma nos pendentes compatíveis e cria o resto. */
export function mergeIntoList(existing: ListItem[], incoming: DraftItem[]): MergePlan {
  const pending = existing.filter((i) => !i.bought)
  const updates = new Map<string, MergePlan['updates'][number]>()
  const inserts: DraftItem[] = []
  const state = new Map(pending.map((i) => [i.id, { quantity: i.quantity, unit: i.unit, source_recipe_title: i.source_recipe_title }]))
  for (const d of consolidateDrafts(incoming)) {
    const target = pending.find((i) => compatKey(i.name, state.get(i.id)!.unit) === compatKey(d.name, d.unit))
    if (!target) {
      inserts.push(d)
      continue
    }
    const cur = state.get(target.id)!
    const sum = addQuantities(cur, d)
    if (!sum) {
      inserts.push(d)
      continue
    }
    const title = [cur.source_recipe_title, d.source_recipe_title].filter((x, i, a) => x && a.indexOf(x) === i).join(' + ') || null
    const next = { quantity: sum.quantity, unit: sum.unit, source_recipe_title: title }
    state.set(target.id, next)
    updates.set(target.id, { id: target.id, ...next })
  }
  return { updates: [...updates.values()], inserts }
}

// ------------------------------------------------------------------ totais

export interface Totals {
  total: number
  bought: number
  pending: number
  progress: number // 0..1
  estimatedCents: number
  spentCents: number
  differenceCents: number // gasto - estimado, só dos itens comprados
}

export function totalsOf(items: ListItem[]): Totals {
  const total = items.length
  const boughtItems = items.filter((i) => i.bought)
  const estimatedCents = items.reduce((n, i) => n + (i.est_price_cents ?? 0), 0)
  const spentCents = boughtItems.reduce((n, i) => n + (i.paid_price_cents ?? 0), 0)
  const estimatedOfBought = boughtItems.reduce((n, i) => n + (i.est_price_cents ?? 0), 0)
  return {
    total,
    bought: boughtItems.length,
    pending: total - boughtItems.length,
    progress: total ? boughtItems.length / total : 0,
    estimatedCents,
    spentCents,
    differenceCents: spentCents - estimatedOfBought,
  }
}

export function groupByCategory<T extends { category: CategoryKey }>(items: T[]): { key: CategoryKey; label: string; items: T[] }[] {
  return CATEGORIES.map((c) => ({ key: c.key, label: c.label, items: items.filter((i) => i.category === c.key) })).filter((g) => g.items.length > 0)
}

/** "R$ 12,50" digitado → centavos (null se vazio ou inválido). */
export function parsePriceToCents(v: string): number | null {
  const t = v.trim().replace(/^R\$\s*/i, '').replace(/\./g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

export function centsToInput(c: number | null | undefined): string {
  return c == null ? '' : (c / 100).toFixed(2).replace('.', ',')
}

export function formatQty(q: number, unit: string): string {
  const n = q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `${n} ${unitShort(unit)}`
}

/** Texto simples da lista, para copiar ou mandar pelo WhatsApp. */
export function listAsText(list: Pick<ShoppingList, 'name'>, items: ListItem[]): string {
  const lines = [`🛒 ${list.name}`]
  for (const g of groupByCategory(items)) {
    lines.push('', `*${g.label}*`)
    for (const i of g.items) lines.push(`${i.bought ? '✅' : '▫️'} ${i.name} — ${formatQty(i.quantity, i.unit)}`)
  }
  return lines.join('\n')
}
