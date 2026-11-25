import { describe, expect, it } from 'vitest'
import { descreverSaldo } from './financas'

describe('descreverSaldo', () => {
  it('positivo é sobra', () => expect(descreverSaldo(10000)).toMatchObject({ estado: 'sobrou', valor: 10000 }))
  it('negativo é falta, nunca sobra', () => {
    const d = descreverSaldo(-50000)
    expect(d.estado).toBe('faltando')
    expect(d.frase).toBe('Está faltando R$ 500,00.')
  })
  it('zero é equilíbrio', () => expect(descreverSaldo(0).estado).toBe('equilibrado'))
})
