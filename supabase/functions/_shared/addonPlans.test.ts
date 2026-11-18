import { describe, expect, it } from 'vitest'
import { ADDON_PLAN_KEYS, addonPriceCents, isAddonPlanKey, isAsaasCycle, packagesForPlan } from './addonPlans.ts'
import { PREMIUM_PRICES_CENTS, PRODUCTS, pricesOf } from '../../../src/lib/plansCatalog.ts'

// O servidor e o app têm cada um o seu catálogo; este teste garante que os
// preços são os mesmos (o servidor nunca cobra um valor diferente do mostrado).
describe('addonPlans', () => {
  it('os preços do servidor batem com os do app, em todos os ciclos', () => {
    for (const p of PRODUCTS) {
      const app = pricesOf(p)
      expect(addonPriceCents(p.key, 'MONTHLY')).toBe(app.monthly)
      expect(addonPriceCents(p.key, 'SEMIANNUALLY')).toBe(app.semiannual)
      expect(addonPriceCents(p.key, 'YEARLY')).toBe(app.annual)
    }
    expect(addonPriceCents('premium', 'MONTHLY')).toBe(PREMIUM_PRICES_CENTS.monthly)
    expect(addonPriceCents('premium', 'SEMIANNUALLY')).toBe(PREMIUM_PRICES_CENTS.semiannual)
    expect(addonPriceCents('premium', 'YEARLY')).toBe(PREMIUM_PRICES_CENTS.annual)
  })

  it('todo plano do app existe no servidor', () => {
    for (const p of PRODUCTS) expect(isAddonPlanKey(p.key)).toBe(true)
    expect(ADDON_PLAN_KEYS).toContain('premium')
  })

  it('recusa plano e ciclo desconhecidos', () => {
    expect(isAddonPlanKey('x')).toBe(false)
    expect(isAsaasCycle('WEEKLY')).toBe(false)
    expect(isAsaasCycle('YEARLY')).toBe(true)
  })

  it('o Premium libera o pacote premium; revista e receitas ainda não têm trava', () => {
    expect(packagesForPlan('premium')).toEqual(['premium'])
    expect(packagesForPlan('magazine')).toEqual(['magazine'])
    expect(packagesForPlan('wellness')).toEqual(['wellness'])
    expect(packagesForPlan('minha_lista')).toEqual(['minha_lista'])
  })
})
