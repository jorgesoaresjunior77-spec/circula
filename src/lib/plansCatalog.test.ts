import { describe, it, expect } from 'vitest'
import {
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_PRICES_CENTS,
  PREMIUM_SEPARATE_MONTHLY_CENTS,
  PRODUCTS,
  PRODUCT_PRICES_CENTS,
  formatBrl,
  pricesOf,
  savingsPercent,
} from './plansCatalog'

describe('plansCatalog', () => {
  it('os avulsos novos têm os preços pedidos', () => {
    const by = Object.fromEntries(PRODUCTS.map((p) => [p.key, p.monthlyCents]))
    expect(by.respiracao).toBe(580)
    expect(by.playlist).toBe(580)
    expect(by.wellness).toBe(450)
    expect(by.leitura).toBe(450)
    expect(by.minha_lista).toBe(490)
  })
  it('o Premium sai mais barato que a soma de tudo separado', () => {
    expect(PREMIUM_SEPARATE_MONTHLY_CENTS).toBe(8000)
    expect(PREMIUM_MONTHLY_CENTS).toBeLessThan(PREMIUM_SEPARATE_MONTHLY_CENTS)
  })
  it('Premium: R$ 59,80, e semestral/anual mantêm 20% e 35% sobre o novo valor', () => {
    expect(PREMIUM_MONTHLY_CENTS).toBe(5980)
    expect(PREMIUM_PRICES_CENTS.semiannual).toBe(Math.round(5980 * 6 * 0.8))
    expect(PREMIUM_PRICES_CENTS.annual).toBe(Math.round(5980 * 12 * 0.65))
  })
  it('calcula a economia frente ao mensal', () => {
    expect(savingsPercent('semiannual', PRODUCT_PRICES_CENTS.semiannual, 990)).toBe(16)
    expect(savingsPercent('annual', PRODUCT_PRICES_CENTS.annual, 990)).toBe(33)
    expect(savingsPercent('semiannual', PREMIUM_PRICES_CENTS.semiannual, PREMIUM_MONTHLY_CENTS)).toBe(20)
    expect(savingsPercent('annual', PREMIUM_PRICES_CENTS.annual, PREMIUM_MONTHLY_CENTS)).toBe(35)
    expect(savingsPercent('monthly', 990, 990)).toBe(0)
  })
  it('semestral e anual dos avulsos novos ficam abaixo do mensal vezes os meses', () => {
    const wellness = PRODUCTS.find((p) => p.key === 'wellness')!
    const prices = pricesOf(wellness)
    expect(prices.semiannual).toBeLessThan(450 * 6)
    expect(prices.annual).toBeLessThan(450 * 12)
  })
  it('formata em reais', () => {
    expect(formatBrl(990).replace(/\s/g, ' ')).toBe('R$ 9,90')
  })
})
