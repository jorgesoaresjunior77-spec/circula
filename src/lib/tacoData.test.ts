import { describe, expect, it } from 'vitest'
import csv from '../../public/taco-4a-edicao.csv?raw'
import { parseFoodsCsv } from './nutriPlan'

// Confere o arquivo da tabela TACO que o app oferece para importar: lê com o
// mesmo importador da tela e confere alimentos conhecidos da tabela oficial.

const parsed = parseFoodsCsv(csv)
const byName = (n: string) => parsed.rows.find((r) => r.name === n)

describe('tabela TACO (4a edição)', () => {
  it('importa sem erro e sem linha descartada', () => {
    expect(parsed.error).toBeNull()
    expect(parsed.skipped).toBe(0)
    expect(parsed.rows.length).toBe(591)
  })

  it('tem os valores da tabela oficial para alimentos conhecidos', () => {
    expect(byName('Arroz, integral, cozido')).toMatchObject({ kcal: 124, protein_g: 2.6, carb_g: 25.8, fat_g: 1, fiber_g: 2.7, portion_g: 100 })
    expect(byName('Banana, prata, crua')).toMatchObject({ kcal: 98, protein_g: 1.3, carb_g: 26 })
    expect(byName('Ovo, de galinha, inteiro, cozido/10minutos')).toMatchObject({ kcal: 146, protein_g: 13.3 })
  })

  it('todo alimento tem calorias plausíveis (0 a 950 kcal por 100 g) e categoria', () => {
    for (const r of parsed.rows) {
      expect(r.kcal).not.toBeNull()
      expect(r.kcal as number).toBeGreaterThanOrEqual(0)
      expect(r.kcal as number).toBeLessThanOrEqual(950)
      expect(r.category).toBeTruthy()
    }
  })
})
