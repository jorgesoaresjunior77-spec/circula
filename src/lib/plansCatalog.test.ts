import { describe, it, expect } from 'vitest'
import {
  PACK_MONTHLY_CENTS,
  PACK_PRICES_CENTS,
  PRODUCT_PRICES_CENTS,
  formatBrl,
  savingsPercent,
} from './plansCatalog'

describe('plansCatalog', () => {
  it('o superpacote mensal é Círcula + 3 produtos', () => {
    expect(PACK_MONTHLY_CENTS).toBe(4460)
  })
  it('calcula a economia frente ao mensal', () => {
    expect(savingsPercent('semiannual', PRODUCT_PRICES_CENTS.semiannual, 990)).toBe(16)
    expect(savingsPercent('annual', PRODUCT_PRICES_CENTS.annual, 990)).toBe(33)
    expect(savingsPercent('semiannual', PACK_PRICES_CENTS.semiannual, PACK_MONTHLY_CENTS)).toBe(20)
    expect(savingsPercent('annual', PACK_PRICES_CENTS.annual, PACK_MONTHLY_CENTS)).toBe(35)
    expect(savingsPercent('monthly', 990, 990)).toBe(0)
  })
  it('formata em reais', () => {
    expect(formatBrl(990).replace(/\s/g, ' ')).toBe('R$ 9,90')
  })
})
