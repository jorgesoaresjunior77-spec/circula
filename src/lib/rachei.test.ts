import { describe, it, expect } from 'vitest'
import { calcularRacha, comGorjeta } from './rachei'

const gente = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bia' },
  { id: 'c', nome: 'Clara' },
]

describe('Rachei $', () => {
  it('soma a gorjeta ao centavo', () => {
    expect(comGorjeta(10000, 10)).toBe(11000)
    expect(comGorjeta(9999, 10)).toBe(10999)
    expect(comGorjeta(10000, 0)).toBe(10000)
    expect(comGorjeta(0, 10)).toBe(0)
  })
  it('divide sem perder nem criar centavos', () => {
    const r = calcularRacha(10000, 0, gente)
    expect(r.partes.map((p) => p.valor).sort()).toEqual([3333, 3333, 3334])
    expect(r.partes.reduce((s, p) => s + p.valor, 0)).toBe(10000)
  })
  it('com gorjeta, divide o total já com ela', () => {
    const r = calcularRacha(9000, 10, gente)
    expect(r.total).toBe(9900)
    expect(r.partes.every((p) => p.valor === 3300)).toBe(true)
  })
  it('quem pagou a conta recebe das outras', () => {
    const r = calcularRacha(9000, 0, gente, 'a')
    expect(r.transferencias).toEqual([
      { de: 'b', para: 'a', valor: 3000 },
      { de: 'c', para: 'a', valor: 3000 },
    ])
  })
  it('sem valor ou sem gente não calcula nada', () => {
    expect(calcularRacha(0, 10, gente).partes.every((p) => p.valor === 0)).toBe(true)
    expect(calcularRacha(5000, 0, []).partes).toEqual([])
  })
})
