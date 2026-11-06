import { describe, it, expect } from 'vitest'
import { dailyGoalMl, formatLiters, formatMl, parseWeight, waterProgress } from './water'

describe('dailyGoalMl — estimativa educativa (35 ml por kg, de 50 em 50)', () => {
  it('calcula e arredonda', () => {
    expect(dailyGoalMl(60)).toBe(2100)
    expect(dailyGoalMl(70)).toBe(2450)
    expect(dailyGoalMl(62.5)).toBe(2200) // 2187,5 -> 2200
    expect(dailyGoalMl(55.3)).toBe(1950) // 1935,5 -> 1950
  })

  it('recusa peso fora do aceitável', () => {
    expect(dailyGoalMl(19.9)).toBeNull()
    expect(dailyGoalMl(301)).toBeNull()
    expect(dailyGoalMl(Number.NaN)).toBeNull()
    expect(dailyGoalMl(-5)).toBeNull()
  })
})

describe('formatação', () => {
  it('litros e mililitros no padrão brasileiro', () => {
    expect(formatLiters(2450)).toBe('2,45 L')
    expect(formatLiters(2000)).toBe('2 L')
    expect(formatMl(2450)).toBe('2.450 ml')
    expect(formatMl(300)).toBe('300 ml')
  })
})

describe('waterProgress', () => {
  it('vai de 0 a 1 e nunca passa da garrafa cheia', () => {
    expect(waterProgress(0, 2000)).toBe(0)
    expect(waterProgress(1000, 2000)).toBe(0.5)
    expect(waterProgress(2000, 2000)).toBe(1)
    expect(waterProgress(3500, 2000)).toBe(1)
  })

  it('sem meta não há progresso', () => {
    expect(waterProgress(500, null)).toBe(0)
    expect(waterProgress(500, 0)).toBe(0)
  })
})

describe('parseWeight', () => {
  it('aceita vírgula e ponto', () => {
    expect(parseWeight('62')).toBe(62)
    expect(parseWeight('62,5')).toBe(62.5)
    expect(parseWeight(' 62.5 ')).toBe(62.5)
  })

  it('texto vazio ou inválido vira null', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('   ')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
  })
})
