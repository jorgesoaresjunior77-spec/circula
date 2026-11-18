import { describe, expect, it } from 'vitest'
import {
  addQuantities,
  centsToInput,
  consolidateDrafts,
  guessCategory,
  ingredientsToDrafts,
  mergeIntoList,
  nameKey,
  parseIngredientLine,
  parsePriceToCents,
  totalsOf,
} from './shopping'
import type { ListItem } from './shopping'

describe('leitura de ingredientes', () => {
  it('quantidade, unidade e nome', () => {
    expect(parseIngredientLine('2 ovos')).toMatchObject({ name: 'ovos', quantity: 2, unit: 'un' })
    expect(parseIngredientLine('200 g de frango')).toMatchObject({ name: 'frango', quantity: 200, unit: 'g' })
    expect(parseIngredientLine('1,5 kg de batata')).toMatchObject({ name: 'batata', quantity: 1.5, unit: 'kg' })
    expect(parseIngredientLine('1/2 cebola')).toMatchObject({ name: 'cebola', quantity: 0.5 })
    expect(parseIngredientLine('1 1/2 litro de leite')).toMatchObject({ name: 'leite', quantity: 1.5, unit: 'l' })
    expect(parseIngredientLine('- 3 tomates, picados')).toMatchObject({ name: 'tomates', quantity: 3, notes: 'picados' })
  })
  it('medida caseira fica no nome e não vira peso', () => {
    expect(parseIngredientLine('1 xícara de arroz')).toMatchObject({ name: 'arroz (xicara)', quantity: 1, unit: 'un' })
    expect(parseIngredientLine('2 colheres de sopa de azeite')).toMatchObject({ name: 'azeite (colher de sopa)', quantity: 2 })
  })
  it('sem quantidade vira 1 unidade com a observação', () => {
    expect(parseIngredientLine('sal a gosto')).toMatchObject({ name: 'sal', quantity: 1, notes: 'a gosto' })
    expect(parseIngredientLine('   ')).toBeNull()
  })
})

describe('consolidação', () => {
  it('exemplo do pedido: 2+3 ovos, 1+2 tomates, 200 g de frango', () => {
    const a = ingredientsToDrafts('2 ovos\n1 tomate\n200 g de frango', 1, { id: 'r1', title: 'Receita 1' })
    const b = ingredientsToDrafts('3 ovos\n2 tomates', 1, { id: 'r2', title: 'Receita 2' })
    const r = consolidateDrafts([...a, ...b])
    const by = Object.fromEntries(r.map((i) => [nameKey(i.name), i]))
    expect(r).toHaveLength(3)
    expect(by['ovo']).toMatchObject({ quantity: 5, unit: 'un' })
    expect(by['tomate']).toMatchObject({ quantity: 3, unit: 'un' })
    expect(by['frango']).toMatchObject({ quantity: 200, unit: 'g' })
    expect(by['ovo'].source_recipe_title).toBe('Receita 1 + Receita 2')
  })
  it('soma g com kg e ml com l, mas não mistura peso com unidade', () => {
    expect(addQuantities({ quantity: 600, unit: 'g' }, { quantity: 0.5, unit: 'kg' })).toEqual({ quantity: 1.1, unit: 'kg' })
    expect(addQuantities({ quantity: 500, unit: 'ml' }, { quantity: 1, unit: 'l' })).toEqual({ quantity: 1.5, unit: 'l' })
    expect(addQuantities({ quantity: 2, unit: 'un' }, { quantity: 200, unit: 'g' })).toBeNull()
    const r = consolidateDrafts([
      { name: 'ovos', category: 'ovos_laticinios', quantity: 2, unit: 'un', notes: null },
      { name: 'ovos', category: 'ovos_laticinios', quantity: 100, unit: 'g', notes: null },
    ])
    expect(r).toHaveLength(2)
  })
  it('porções multiplicam as quantidades sem mexer no texto da receita', () => {
    const text = '2 ovos\n200 g de frango'
    const d = ingredientsToDrafts(text, 2, { id: 'r', title: 'R' })
    expect(d.map((x) => x.quantity)).toEqual([4, 400])
    expect(text).toBe('2 ovos\n200 g de frango')
  })
  it('importar para uma lista existente soma nos pendentes e não mexe nos comprados', () => {
    const item = (id: string, name: string, q: number, unit: ListItem['unit'], bought = false): ListItem => ({
      id, list_id: 'l', name, category: 'outros', quantity: q, unit, est_price_cents: null, paid_price_cents: null, notes: null,
      bought, position: 0, source_recipe_id: null, source_recipe_title: null,
    })
    const plan = mergeIntoList(
      [item('1', 'Ovos', 2, 'un'), item('2', 'Tomate', 1, 'un', true)],
      [
        { name: 'ovos', category: 'ovos_laticinios', quantity: 3, unit: 'un', notes: null },
        { name: 'tomates', category: 'verduras_legumes', quantity: 2, unit: 'un', notes: null },
      ],
    )
    expect(plan.updates).toEqual([{ id: '1', quantity: 5, unit: 'un', source_recipe_title: null }])
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0].name).toBe('tomates')
  })
})

describe('categorias e preços', () => {
  it('sugere a categoria pelo nome', () => {
    expect(guessCategory('banana prata')).toBe('frutas')
    expect(guessCategory('peito de frango')).toBe('carnes_aves')
    expect(guessCategory('arroz integral')).toBe('graos_cereais')
    expect(guessCategory('coisa estranha')).toBe('outros')
  })
  it('lê e mostra preços em centavos', () => {
    expect(parsePriceToCents('R$ 12,50')).toBe(1250)
    expect(parsePriceToCents('1.234,5')).toBe(123450)
    expect(parsePriceToCents('')).toBeNull()
    expect(centsToInput(1250)).toBe('12,50')
  })
  it('totais: estimado, gasto, diferença e progresso', () => {
    const mk = (over: Partial<ListItem>): ListItem => ({
      id: 'x', list_id: 'l', name: 'a', category: 'outros', quantity: 1, unit: 'un', est_price_cents: null, paid_price_cents: null,
      notes: null, bought: false, position: 0, source_recipe_id: null, source_recipe_title: null, ...over,
    })
    const t = totalsOf([
      mk({ est_price_cents: 1000, paid_price_cents: 1200, bought: true }),
      mk({ est_price_cents: 500 }),
      mk({ est_price_cents: 300, paid_price_cents: 250, bought: true }),
    ])
    expect(t).toMatchObject({ total: 3, bought: 2, pending: 1, estimatedCents: 1800, spentCents: 1450, differenceCents: 150 })
    expect(t.progress).toBeCloseTo(2 / 3)
  })
})
