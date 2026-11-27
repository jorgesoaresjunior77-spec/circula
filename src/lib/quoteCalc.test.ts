import { describe, expect, it } from 'vitest'
import { parseLast, simulatePurchase } from './quotes'

describe('simulatePurchase', () => {
  it('R$ 100 em Bitcoin pela cotação de venda (ask)', () => {
    const r = simulatePurchase(100, { bid: 334089, ask: 334099 })
    expect(r?.price).toBe(334099)
    expect(r?.quantity).toBeCloseTo(100 / 334099, 12)
  })
  it('sem ask usa o bid', () => {
    expect(simulatePurchase(56.5, { bid: 5.65 })?.quantity).toBeCloseTo(10, 10)
  })
  it('desconta a taxa informada antes de converter', () => {
    const r = simulatePurchase(100, { bid: 5, ask: 5 }, 2)
    expect(r?.feeBrl).toBe(2)
    expect(r?.quantity).toBeCloseTo(19.6, 10)
  })
  it('valor ou cotação inválidos não calculam', () => {
    expect(simulatePurchase(0, { bid: 5 })).toBeNull()
    expect(simulatePurchase(10, { bid: 0 })).toBeNull()
    expect(simulatePurchase(10, { bid: 5 }, 100)).toBeNull()
  })
  it('lê o ask da resposta da API', () => {
    const q = parseLast({ BTCBRL: { bid: '334089', ask: '334099', pctChange: '-4.2', timestamp: '1795793783' } })
    expect(q[0]).toMatchObject({ code: 'BTC', bid: 334089, ask: 334099 })
  })
})
