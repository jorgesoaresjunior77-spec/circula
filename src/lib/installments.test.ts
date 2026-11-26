import { describe, it, expect } from 'vitest'
import { installmentOptions, installmentSplit, maxInstallments, premiumPricesAt } from './plansCatalog'

const LANCAMENTO = new Date('2026-11-26T12:00:00-03:00')

describe('auditoria financeira do Premium (lançamento R$ 49,90)', () => {
  it('mensal 49,90; semestral = 6 × 49,90 − 20%; anual = 12 × 49,90 − 35% (desconto aplicado uma vez só)', () => {
    const p = premiumPricesAt(LANCAMENTO)
    expect(p.monthly).toBe(4990)
    expect(4990 * 6).toBe(29940)
    expect(4990 * 12).toBe(59880)
    expect(p.semiannual).toBe(Math.round(29940 * 0.8)) // R$ 239,52
    expect(p.annual).toBe(Math.round(59880 * 0.65)) // R$ 389,22
  })
  it('parcelas: até 6x no semestral e 12x no anual; o mensal não parcela', () => {
    expect(maxInstallments('monthly')).toBe(1)
    expect(maxInstallments('semiannual')).toBe(6)
    expect(maxInstallments('annual')).toBe(12)
    expect(installmentOptions('annual', 38922)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
  it('o valor das parcelas soma exatamente o total (sobra na última, em centavos)', () => {
    for (const [total, n] of [
      [38922, 12],
      [23952, 6],
      [38922, 7],
    ] as const) {
      const { each, last } = installmentSplit(total, n)
      expect(each * (n - 1) + last).toBe(total)
    }
    expect(installmentSplit(38922, 12)).toEqual({ each: 3243, last: 3249 })
  })
  it('parcela mínima de R$ 5,00 limita as opções em valores baixos', () => {
    expect(installmentOptions('annual', 4000)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
