import { describe, expect, it } from 'vitest'
import { compareStores, observations, priceByStore, priceTimeline, productKey, productOptions, trendPercent, unitPrice } from './priceInsights'
import type { PurchaseRow } from './priceInsights'

const item = (name: string, paid: number | null, quantity = 1, unit = 'un', brand: string | null = null) => ({
  name, brand, category: 'outros', quantity, unit, paid_price_cents: paid,
})

const purchases: PurchaseRow[] = [
  { id: 'a', store_name: 'Mercado A', purchased_on: '2027-01-10', total_cents: 0, items_count: 0, items: [item('Arroz', 2490, 5, 'kg', 'Tio João'), item('Feijão', 900, 1, 'kg', 'Camil'), item('Leite', 600, 1, 'l', 'Piracanjuba')] },
  { id: 'b', store_name: 'mercado b', purchased_on: '2027-02-05', total_cents: 0, items_count: 0, items: [item('arroz', 2290, 5, 'kg', 'Tio João'), item('Feijao', 1000, 1, 'kg', 'Camil'), item('Leite', 500, 1000, 'ml', 'Italac')] },
  { id: 'c', store_name: 'Mercado A', purchased_on: '2027-03-01', total_cents: 0, items_count: 0, items: [item('Arroz', 2690, 5, 'kg', 'Tio João')] },
]

describe('unitPrice', () => {
  it('normaliza por kg, litro e unidade', () => {
    expect(unitPrice(item('x', 2490, 5, 'kg'))).toEqual({ cents: 498, base: 'kg' })
    expect(unitPrice(item('x', 500, 500, 'g'))).toEqual({ cents: 1000, base: 'kg' })
    expect(unitPrice(item('x', 600, 1000, 'ml'))).toEqual({ cents: 600, base: 'L' })
    expect(unitPrice(item('x', 1200, 1, 'duzia'))).toEqual({ cents: 100, base: 'un' })
  })
  it('sem preço ou sem quantidade não calcula', () => {
    expect(unitPrice(item('x', null))).toBeNull()
    expect(unitPrice(item('x', 100, 0))).toBeNull()
  })
})

describe('productKey', () => {
  it('na mesma marca, produto sem marca fica de fora', () => {
    expect(productKey(item('Arroz', 100, 1, 'kg'), 'same_brand')).toBeNull()
    expect(productKey(item('Arroz', 100, 1, 'kg', 'Tio João'), 'same_brand')).toBe('arroz|tio joao|kg')
  })
  it('na comparação geral, ignora a marca mas não mistura unidades diferentes', () => {
    expect(productKey(item('Arroz', 100, 1, 'kg', 'A'), 'any_brand')).toBe(productKey(item('arroz', 100, 1, 'kg', 'B'), 'any_brand'))
    expect(productKey(item('Arroz', 100, 1, 'pacote'), 'any_brand')).not.toBe(productKey(item('Arroz', 100, 1, 'kg'), 'any_brand'))
  })
})

describe('gráficos', () => {
  it('produto por mercado: último preço de cada mercado e o mais barato', () => {
    const obs = observations(purchases, 'same_brand')
    const rows = priceByStore(obs, 'arroz|tio joao|kg')
    expect(rows.map((r) => [r.store, r.cents, r.cheapest])).toEqual([
      ['mercado b', 458, true],
      ['Mercado A', 538, false],
    ])
  })
  it('compara mercados só pela cesta comum', () => {
    const cmp = compareStores(observations(purchases, 'same_brand'))
    expect(cmp?.basket.sort()).toEqual(['arroz|tio joao|kg', 'feijao|camil|kg'])
    expect(cmp?.stores[0]).toMatchObject({ store: 'Mercado A', cents: 538 + 900, cheapest: true })
    expect(cmp?.stores[1]).toMatchObject({ store: 'mercado b', cents: 458 + 1000, cheapest: false })
  })
  it('sem 2 produtos em comum, não inventa comparação', () => {
    expect(compareStores(observations([purchases[0]], 'any_brand'))).toBeNull()
  })
  it('comparação geral avisa quando há marcas diferentes', () => {
    const opts = productOptions(observations(purchases, 'any_brand'))
    expect(opts.find((o) => o.key === 'leite||L')?.mixedBrands).toBe(true)
    expect(opts.find((o) => o.key === 'arroz||kg')?.mixedBrands).toBe(false)
  })
  it('linha do tempo por mês e tendência', () => {
    const pts = priceTimeline(observations(purchases, 'any_brand'), 'arroz||kg')
    expect(pts.map((p) => [p.month, p.cents])).toEqual([
      ['2027-01', 498],
      ['2027-02', 458],
      ['2027-03', 538],
    ])
    expect(trendPercent(pts)).toBe(8)
  })
})
