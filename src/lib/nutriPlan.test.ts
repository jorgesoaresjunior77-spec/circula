import { describe, expect, it } from 'vitest'
import {
  dayTotals,
  estimateEnergy,
  macroSplit,
  nutrientsFor,
  parseFoodsCsv,
  recipePerPortion,
  sumNutrients,
} from './nutriPlan'
import type { Food, PlanMeal } from './nutriPlan'

const arroz: Food = {
  id: 'f1',
  name: 'Arroz cozido',
  category: 'Cereais',
  portion_label: '4 colheres de sopa',
  portion_g: 100,
  kcal: 130,
  protein_g: 2.5,
  carb_g: 28,
  fat_g: 0.2,
  sat_fat_g: null,
  fiber_g: 0.4,
  sodium_mg: null,
  source: 'propria',
}

describe('nutrientes por quantidade', () => {
  it('escala pela porção de referência', () => {
    expect(nutrientsFor(arroz, 150)).toEqual({ kcal: 195, protein: 3.8, carb: 42, fat: 0.3, fiber: 0.6 })
  })
  it('sem calorias informadas ou sem quantidade, não inventa valor', () => {
    expect(nutrientsFor({ ...arroz, kcal: null }, 100)).toBeNull()
    expect(nutrientsFor(arroz, 0)).toBeNull()
  })
})

describe('totais', () => {
  it('soma e conta itens sem dados', () => {
    const r = sumNutrients([nutrientsFor(arroz, 100), null, nutrientsFor(arroz, 100)])
    expect(r.total.kcal).toBe(260)
    expect(r.missing).toBe(1)
  })
  it('total do dia soma todas as refeições', () => {
    const item = (g: number) => ({
      id: 'i', kind: 'food' as const, refId: 'f1', name: 'Arroz', grams: g, household: '', portions: '', prep: '', note: '',
      nutrients: nutrientsFor(arroz, g), substitutions: [],
    })
    const meals: PlanMeal[] = [
      { id: 'a', name: 'Almoço', time: '12:00', notes: '', items: [item(100)] },
      { id: 'b', name: 'Jantar', time: '19:00', notes: '', items: [item(200)] },
    ]
    expect(dayTotals(meals).total.kcal).toBe(390)
  })
  it('distribuição de macros pelas calorias', () => {
    expect(macroSplit({ kcal: 0, protein: 25, carb: 50, fat: 11.1, fiber: 0 })).toEqual({ protein: 25, carb: 50, fat: 25 })
    expect(macroSplit({ kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 })).toBeNull()
  })
  it('receita: total dividido pelo rendimento', () => {
    const r = recipePerPortion([nutrientsFor(arroz, 200), nutrientsFor(arroz, 200)], 4)
    expect(r.perPortion.kcal).toBe(130)
  })
})

describe('estimativa de energia', () => {
  it('Mifflin-St Jeor mostra a fórmula e os parâmetros', () => {
    const e = estimateEnergy({ sex: 'F', age: 30, weightKg: 60, heightCm: 165, activityFactor: 1.375 })
    expect(e?.bmr).toBe(1320) // 600 + 1031,25 - 150 - 161 = 1320,25
    expect(e?.total).toBe(1815)
    expect(e?.formula).toBe('Mifflin-St Jeor')
    expect(estimateEnergy({ sex: 'M', age: 0, weightKg: 60, heightCm: 165, activityFactor: 1.2 })).toBeNull()
  })
})

describe('importação CSV', () => {
  it('lê separador ; e vírgula decimal, e ignora linhas inválidas', () => {
    const csv = 'Nome;Categoria;Porção (g);Calorias;Proteína;Carboidrato;Gordura;Fibra\nArroz;Cereais;100;130,5;2,5;28;0,2;0,4\n;Sem nome;100;1;1;1;1;1\nOvo;Ovos;50;71;6;0,4;4,8;'
    const r = parseFoodsCsv(csv)
    expect(r.error).toBeNull()
    expect(r.rows).toHaveLength(2)
    expect(r.skipped).toBe(1)
    expect(r.rows[0]).toMatchObject({ name: 'Arroz', portion_g: 100, kcal: 130.5, protein_g: 2.5 })
    expect(r.rows[1].fiber_g).toBeNull()
  })
  it('pede a coluna nome', () => {
    expect(parseFoodsCsv('a;b\n1;2').error).toMatch(/nome/)
  })
})

describe('lista de compras', () => {
  it('soma alimentos iguais, multiplica pelos dias e mantém itens sem gramas', async () => {
    const { shoppingList } = await import('./nutriPlan')
    const mk = (name: string, grams: number | null) => ({
      id: name + grams, kind: 'food' as const, refId: null, name, grams, household: '', portions: '', prep: '', note: '', nutrients: null, substitutions: [],
    })
    const list = shoppingList(
      [
        { id: 'a', name: 'Almoço', time: '', notes: '', items: [mk('Arroz', 100), mk('Alface', null)] },
        { id: 'b', name: 'Jantar', time: '', notes: '', items: [mk('arroz', 50)] },
      ],
      7,
    )
    expect(list).toEqual([
      { name: 'Alface', grams: null, times: 1 },
      { name: 'Arroz', grams: 1050, times: 2 },
    ])
  })
})
