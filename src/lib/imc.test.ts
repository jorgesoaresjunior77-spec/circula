import { describe, it, expect } from 'vitest'
import { calcImc, imcRange, parseDecimal } from './imc'

describe('imc', () => {
  it('calcula com uma casa decimal', () => {
    expect(calcImc(62.5, 165)).toBe(23)
    expect(calcImc(80, 170)).toBe(27.7)
  })
  it('aceita vírgula e rejeita lixo', () => {
    expect(parseDecimal('62,5')).toBe(62.5)
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('0')).toBeNull()
  })
  it('usa texto neutro por faixa', () => {
    expect(imcRange(17)).toMatch(/abaixo/)
    expect(imcRange(22)).toMatch(/dentro/)
    expect(imcRange(27)).toMatch(/acima/)
    expect(imcRange(35)).toMatch(/bem acima/)
  })
})
