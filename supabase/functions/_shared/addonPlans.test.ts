import { describe, expect, it } from 'vitest'
import { fixedPeriodEnd, installmentSplit, isValidInstallments, maxInstallments } from './addonPlans.ts'
import { ADDON_PLAN_KEYS, applyReferralDiscount, addonPeriodEnd, addonPriceCents, isAddonPlanKey, isAsaasCycle, packagesForPlan, bundlePriceCents, premiumPricesAt, sanitizeBundle } from './addonPlans.ts'
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
    // Em 2026: R$ 49,90. A partir de 01/01/2027 (Brasília): R$ 59,90.
    const dentro = new Date('2026-12-31T23:59:00-03:00')
    const depois = new Date('2027-01-01T00:00:00-03:00')
    expect(addonPriceCents('premium', 'MONTHLY', null, dentro)).toBe(4990)
    expect(addonPriceCents('premium', 'SEMIANNUALLY', null, dentro)).toBe(23952)
    expect(addonPriceCents('premium', 'YEARLY', null, dentro)).toBe(38922)
    expect(addonPriceCents('premium', 'MONTHLY', null, depois)).toBe(5990)
    expect(addonPriceCents('premium', 'YEARLY', null, depois)).toBe(46722)
    expect(premiumPricesAt(dentro).MONTHLY).toBe(4990)
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

describe('addonPeriodEnd', () => {
  const now = new Date('2026-11-19T12:00:00Z')
  it('primeiro pagamento: um ciclo a partir do vencimento', () => {
    expect(addonPeriodEnd('2026-11-19', 'MONTHLY', null, now)?.toISOString()).toBe('2026-12-19T00:00:00.000Z')
  })
  it('PAYMENT_RECEIVED depois de PAYMENT_CONFIRMED não soma de novo', () => {
    const first = addonPeriodEnd('2026-11-19', 'MONTHLY', null, now)!
    expect(addonPeriodEnd('2026-11-19', 'MONTHLY', first.toISOString(), new Date('2026-11-21T12:00:00Z'))).toBeNull()
  })
  it('renovação: o vencimento seguinte estende mais um ciclo', () => {
    const next = addonPeriodEnd('2026-12-19', 'MONTHLY', '2026-12-19T00:00:00.000Z', new Date('2026-12-19T09:00:00Z'))
    expect(next?.toISOString()).toBe('2027-01-19T00:00:00.000Z')
  })
  it('pagamento muito atrasado ganha um ciclo inteiro a partir de hoje', () => {
    expect(addonPeriodEnd('2026-08-01', 'MONTHLY', null, now)?.toISOString()).toBe('2026-12-19T12:00:00.000Z')
  })
  it('semestral e anual somam 6 e 12 meses', () => {
    expect(addonPeriodEnd('2026-11-19', 'SEMIANNUALLY', null, now)?.toISOString()).toBe('2027-05-19T00:00:00.000Z')
    expect(addonPeriodEnd('2026-11-19', 'YEARLY', null, now)?.toISOString()).toBe('2027-11-19T00:00:00.000Z')
  })
})

describe('indicação Premium', () => {
  it('tira 10% do Premium, arredondando em R$ 0,10', () => {
    expect(applyReferralDiscount(5990)).toBe(5390)
    expect(applyReferralDiscount(28752)).toBe(25880)
  })
})

describe('novos planos', () => {
  it('Meu Chef e Lista inteligente têm preço e pacote próprios', () => {
    expect(addonPriceCents('meu_chef', 'MONTHLY')).toBe(890)
    expect(addonPriceCents('lista_inteligente', 'MONTHLY')).toBe(590)
    expect(packagesForPlan('meu_chef')).toEqual(['meu_chef'])
    expect(packagesForPlan('lista_inteligente')).toEqual(['lista_inteligente'])
    expect(addonPriceCents('exercicios', 'MONTHLY')).toBe(790)
    expect(addonPriceCents('series_filmes', 'MONTHLY')).toBe(590)
    expect(addonPriceCents('exercicios', 'MONTHLY', 690)).toBe(690)
    expect(packagesForPlan('exercicios')).toEqual(['exercicios'])
    expect(packagesForPlan('series_filmes')).toEqual(['series_filmes'])
    expect(addonPriceCents('viagens', 'MONTHLY')).toBe(590)
    expect(packagesForPlan('viagens')).toEqual(['viagens'])
  })
})

describe('cesta de assinaturas', () => {
  it('só conteúdos avulsos válidos, sem repetir e sem o Premium', () => {
    expect(sanitizeBundle(['respiracao', 'respiracao', 'premium', 'xyz', 'playlist'])).toEqual(['respiracao', 'playlist'])
    expect(sanitizeBundle(['carro', 'financas'])).toEqual(['carro', 'financas'])
    expect(addonPriceCents('carro', 'MONTHLY')).toBe(450)
    expect(addonPriceCents('financas', 'MONTHLY')).toBe(990)
    expect(addonPriceCents('rachei', 'MONTHLY')).toBe(490)
    expect(packagesForPlan('rachei')).toEqual(['rachei'])
    expect(packagesForPlan('financas')).toEqual(['financas'])
    expect(sanitizeBundle('nada')).toEqual([])
  })

  it('o preço é a soma dos conteúdos no ciclo e libera todos os pacotes', () => {
    expect(bundlePriceCents(['respiracao', 'playlist'], 'MONTHLY')).toBe(590 + 590)
    expect(packagesForPlan('cesta', ['respiracao', 'playlist'])).toEqual(['respiracao', 'playlist'])
    expect(packagesForPlan('cesta', null)).toEqual([])
  })
})

describe('auditoria 26/11: total do ciclo e parcelamento no servidor', () => {
  const lancamento = new Date('2026-11-26T12:00:00-03:00')
  it('anual e semestral cobram o TOTAL do ciclo (nunca só o mensal)', () => {
    expect(addonPriceCents('premium', 'YEARLY', null, lancamento)).toBe(38922)
    expect(addonPriceCents('premium', 'SEMIANNUALLY', null, lancamento)).toBe(23952)
    expect(addonPriceCents('premium', 'MONTHLY', null, lancamento)).toBe(4990)
  })
  it('parcelas válidas por ciclo, com mínimo de R$ 5,00', () => {
    expect(maxInstallments('YEARLY')).toBe(12)
    expect(maxInstallments('SEMIANNUALLY')).toBe(6)
    expect(maxInstallments('MONTHLY')).toBe(1)
    expect(isValidInstallments('YEARLY', 38922, 12)).toBe(true)
    expect(isValidInstallments('YEARLY', 38922, 13)).toBe(false)
    expect(isValidInstallments('MONTHLY', 4990, 2)).toBe(false)
    expect(isValidInstallments('SEMIANNUALLY', 23952, 7)).toBe(false)
    expect(isValidInstallments('YEARLY', 38922, 1.5)).toBe(false)
    expect(installmentSplit(38922, 12)).toEqual({ each: 3243, last: 3249 })
  })
  it('contrato parcelado vale 6 ou 12 meses', () => {
    expect(fixedPeriodEnd(new Date('2026-11-26T00:00:00Z'), 'YEARLY').toISOString().slice(0, 10)).toBe('2027-11-26')
    expect(fixedPeriodEnd(new Date('2026-11-26T00:00:00Z'), 'SEMIANNUALLY').toISOString().slice(0, 10)).toBe('2027-05-26')
  })
})
