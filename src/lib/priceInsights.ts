import { nameKey, strip } from './shopping'

// Inteligência de preços da Minha Lista. Usa só o que a própria pessoa
// registrou (compras salvas no histórico). Nada é estimado ou inventado:
// sem dado suficiente, as funções devolvem listas vazias e a tela explica.
//
// Unidades diferentes: o preço vira "por kg", "por litro" ou "por unidade"
// quando dá (kg/g, L/ml, un/dúzia). Pacote, caixa, bandeja e pote só se
// comparam com o mesmo tipo de embalagem.

export interface PurchaseItemRow {
  name: string
  brand: string | null
  category: string
  quantity: number
  unit: string
  paid_price_cents: number | null
}

export interface PurchaseRow {
  id: string
  store_name: string
  purchased_on: string // AAAA-MM-DD
  total_cents: number
  items_count: number
  items: PurchaseItemRow[]
}

export type CompareMode = 'same_brand' | 'any_brand'

export interface UnitPrice {
  /** centavos por base (por kg, por L, por un, por pacote...) */
  cents: number
  base: string
}

const BASE_LABEL: Record<string, string> = {
  kg: 'kg', g: 'kg', l: 'L', ml: 'L', un: 'un', duzia: 'un', pacote: 'pacote', caixa: 'caixa', bandeja: 'bandeja', pote: 'pote',
}

/** Preço por unidade de medida (por kg, L ou unidade), ou null se não der para calcular. */
export function unitPrice(item: Pick<PurchaseItemRow, 'quantity' | 'unit' | 'paid_price_cents'>): UnitPrice | null {
  const paid = item.paid_price_cents
  const q = Number(item.quantity)
  if (paid == null || !(q > 0)) return null
  const base = BASE_LABEL[item.unit]
  if (!base) return null
  const amount = item.unit === 'g' || item.unit === 'ml' ? q / 1000 : item.unit === 'duzia' ? q * 12 : q
  if (!(amount > 0)) return null
  return { cents: Math.round(paid / amount), base }
}

export const storeKey = (s: string): string => strip(s)
export const brandKey = (b: string | null): string => (b ? strip(b) : '')

/** Chave do produto para comparar. Na mesma marca, sem marca não entra (null). */
export function productKey(item: Pick<PurchaseItemRow, 'name' | 'brand' | 'quantity' | 'unit' | 'paid_price_cents'>, mode: CompareMode): string | null {
  const up = unitPrice(item)
  if (!up) return null
  const n = nameKey(item.name)
  if (mode === 'same_brand') {
    const b = brandKey(item.brand)
    if (!b) return null
    return `${n}|${b}|${up.base}`
  }
  return `${n}||${up.base}`
}

export interface Observation {
  key: string
  product: string // nome para mostrar
  brand: string | null
  base: string
  store: string // nome para mostrar
  storeKey: string
  date: string
  cents: number // preço por base
}

/** Todas as observações de preço comparáveis (uma por item comprado com preço). */
export function observations(purchases: PurchaseRow[], mode: CompareMode): Observation[] {
  const out: Observation[] = []
  for (const p of purchases) {
    for (const it of p.items) {
      const key = productKey(it, mode)
      const up = unitPrice(it)
      if (!key || !up) continue
      out.push({
        key,
        product: it.name.trim(),
        brand: it.brand?.trim() || null,
        base: up.base,
        store: p.store_name.trim(),
        storeKey: storeKey(p.store_name),
        date: p.purchased_on,
        cents: up.cents,
      })
    }
  }
  return out
}

export interface ProductOption {
  key: string
  label: string
  base: string
  stores: number
  count: number
  /** Na comparação geral: o produto aparece com marcas diferentes. */
  mixedBrands: boolean
}

/** Produtos que dá para analisar, mais registrados primeiro. */
export function productOptions(obs: Observation[]): ProductOption[] {
  const map = new Map<string, { label: string; base: string; stores: Set<string>; count: number; brands: Set<string> }>()
  for (const o of obs) {
    const cur = map.get(o.key) ?? { label: o.brand && o.key.split('|')[1] ? `${o.product} · ${o.brand}` : o.product, base: o.base, stores: new Set(), count: 0, brands: new Set() }
    cur.stores.add(o.storeKey)
    cur.count += 1
    cur.brands.add(brandKey(o.brand) || '(sem marca)')
    map.set(o.key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, base: v.base, stores: v.stores.size, count: v.count, mixedBrands: v.brands.size > 1 }))
    .sort((a, b) => b.stores - a.stores || b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}

/** Último preço de cada observação por (produto, mercado). */
function latestBy(obs: Observation[]): Map<string, Map<string, Observation>> {
  const byProduct = new Map<string, Map<string, Observation>>()
  for (const o of obs) {
    const stores = byProduct.get(o.key) ?? new Map<string, Observation>()
    const prev = stores.get(o.storeKey)
    if (!prev || o.date > prev.date) stores.set(o.storeKey, o)
    byProduct.set(o.key, stores)
  }
  return byProduct
}

export interface StorePrice {
  store: string
  cents: number
  date: string
  brand: string | null
  cheapest: boolean
}

/** Gráfico 2: onde o produto está mais barato (último preço registrado em cada mercado). */
export function priceByStore(obs: Observation[], key: string): StorePrice[] {
  const stores = latestBy(obs.filter((o) => o.key === key)).get(key)
  if (!stores) return []
  const rows = [...stores.values()].map((o) => ({ store: o.store, cents: o.cents, date: o.date, brand: o.brand, cheapest: false }))
  rows.sort((a, b) => a.cents - b.cents)
  if (rows.length > 1) rows.forEach((r) => (r.cheapest = r.cents === rows[0].cents))
  return rows
}

export interface StoreComparison {
  /** Produtos presentes em todos os mercados comparados (a "cesta comum"). */
  basket: string[]
  stores: { store: string; storeKey: string; cents: number; cheapest: boolean }[]
}

/**
 * Gráfico 1: qual mercado sai mais em conta, somando a MESMA cesta (só os
 * produtos que a pessoa comprou em todos os mercados comparados, com o
 * último preço de cada um). Escolhe o maior grupo de mercados que ainda
 * tem pelo menos 2 produtos em comum.
 */
export function compareStores(obs: Observation[]): StoreComparison | null {
  const latest = latestBy(obs)
  const storeNames = new Map<string, string>()
  for (const o of obs) storeNames.set(o.storeKey, o.store)
  const allStores = [...storeNames.keys()]
  if (allStores.length < 2) return null

  // produtos por mercado
  const productsOf = new Map<string, Set<string>>()
  for (const [key, stores] of latest) for (const s of stores.keys()) productsOf.set(s, (productsOf.get(s) ?? new Set()).add(key))

  // começa com todos e vai tirando o mercado com menos produtos até sobrar cesta comum de 2+
  let group = [...allStores].sort((a, b) => (productsOf.get(b)?.size ?? 0) - (productsOf.get(a)?.size ?? 0))
  while (group.length >= 2) {
    const common = [...(productsOf.get(group[0]) ?? [])].filter((k) => group.every((s) => productsOf.get(s)?.has(k)))
    if (common.length >= 2) {
      const stores = group.map((s) => ({
        store: storeNames.get(s) ?? s,
        storeKey: s,
        cents: common.reduce((sum, k) => sum + (latest.get(k)?.get(s)?.cents ?? 0), 0),
        cheapest: false,
      }))
      stores.sort((a, b) => a.cents - b.cents)
      stores.forEach((x) => (x.cheapest = x.cents === stores[0].cents))
      return { basket: common, stores }
    }
    group = group.slice(0, -1)
  }
  return null
}

export interface MonthPoint {
  month: string // AAAA-MM
  cents: number // média do mês
  count: number
}

/** Gráfico 3: evolução do preço (média por mês, todos os mercados). */
export function priceTimeline(obs: Observation[], key: string): MonthPoint[] {
  const months = new Map<string, { sum: number; count: number }>()
  for (const o of obs) {
    if (o.key !== key) continue
    const m = o.date.slice(0, 7)
    const cur = months.get(m) ?? { sum: 0, count: 0 }
    cur.sum += o.cents
    cur.count += 1
    months.set(m, cur)
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, cents: Math.round(v.sum / v.count), count: v.count }))
}

/** Variação entre o primeiro e o último mês (em %), ou null. */
export function trendPercent(points: MonthPoint[]): number | null {
  if (points.length < 2) return null
  const first = points[0].cents
  const last = points[points.length - 1].cents
  if (!first) return null
  return Math.round(((last - first) / first) * 1000) / 10
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTHS[Number(m) - 1] ?? m}/${y.slice(2)}`
}

export function baseLabel(base: string): string {
  return base === 'L' ? 'litro' : base === 'un' ? 'unidade' : base
}
