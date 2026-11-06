import { describe, it, expect } from 'vitest'
import { HABITS, colorAmount, countDone } from './habits'

describe('habits — os 7 hábitos do ritual', () => {
  it('são exatamente 7, com chaves únicas', () => {
    expect(HABITS).toHaveLength(7)
    expect(new Set(HABITS.map((h) => h.key)).size).toBe(7)
  })

  it('cada integração leva ao destino certo', () => {
    const target = (key: string) => HABITS.find((h) => h.key === key)?.target
    expect(target('agua')).toBe('agua')
    expect(target('leitura')).toBe('leitura')
    expect(target('respiracao')).toBe('respiracao')
    expect(target('organizacao')).toBe('agenda')
  })

  it('luz natural e espiritualidade são marcadas direto no ritual (sem destino)', () => {
    expect(HABITS.find((h) => h.key === 'luz')?.target).toBeUndefined()
    expect(HABITS.find((h) => h.key === 'espiritualidade')?.target).toBeUndefined()
  })
})

describe('countDone / colorAmount', () => {
  it('só conta hábitos conhecidos', () => {
    expect(countDone(new Set(['agua', 'luz', 'inventado']))).toBe(2)
    expect(countDone(new Set())).toBe(0)
  })

  it('a ilustração vai de preto e branco (0) a colorida (1)', () => {
    expect(colorAmount(0)).toBe(0)
    expect(colorAmount(7)).toBe(1)
    expect(colorAmount(3.5)).toBeCloseTo(0.5)
    expect(colorAmount(20)).toBe(1)
    expect(colorAmount(-1)).toBe(0)
  })
})
