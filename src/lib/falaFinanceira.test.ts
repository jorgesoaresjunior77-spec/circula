import { describe, expect, it } from 'vitest'
import { interpretarFala } from './falaFinanceira'

const HOJE = new Date(2026, 10, 25)

describe('interpretarFala', () => {
  it('gasto no supermercado', () => {
    const r = interpretarFala('Hoje gastei 85 reais no supermercado.', [], HOJE)
    expect(r).toMatchObject({ tipo: 'gasto', valorCentavos: 8500, categoria: 'padrao:mercado', data: '2026-11-25' })
  })
  it('receita de consulta', () => {
    const r = interpretarFala('Recebi 250 reais de uma consulta', [], HOJE)
    expect(r).toMatchObject({ tipo: 'receita', valorCentavos: 25000, categoria: 'padrao:consultorio' })
  })
  it('investimento', () => {
    const r = interpretarFala('Investi 500 reais', [], HOJE)
    expect(r).toMatchObject({ tipo: 'investimento', valorCentavos: 50000 })
  })
  it('ontem, centavos e valor por extenso', () => {
    expect(interpretarFala('ontem paguei 12,50 de gasolina', [], HOJE)).toMatchObject({ valorCentavos: 1250, data: '2026-11-24', categoria: 'padrao:transporte' })
    expect(interpretarFala('gastei cento e vinte reais na farmacia', [], HOJE).valorCentavos).toBe(12000)
  })
  it('sem tipo claro, deixa para a pessoa escolher', () => {
    expect(interpretarFala('85 reais', [], HOJE).tipo).toBeNull()
  })
  it('usa categoria própria quando citada', () => {
    const r = interpretarFala('gastei 30 reais com cafeteria', [{ id: 'abc', tipo: 'gasto', nome: 'Cafeteria', icone: 'estrela', padrao: false }], HOJE)
    expect(r.categoria).toBe('abc')
  })
})
