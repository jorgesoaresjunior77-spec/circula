import { describe, it, expect } from 'vitest'
import { IMC_MESSAGE, calcImc, imcBand, imcRange, parseDecimal, scalePosition, scaleStops } from './imc'

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

  it('separa as 4 faixas e cada uma tem mensagem acolhedora, sem julgamento', () => {
    expect([17, 22, 27, 35].map(imcBand)).toEqual(['abaixo', 'referencia', 'acima', 'elevado'])
    expect(IMC_MESSAGE.referencia).toMatch(/Continue cuidando de você/)
    for (const m of Object.values(IMC_MESSAGE)) {
      expect(m).not.toMatch(/gord[ao]|magr[ao]|feio|perfeito|ideal/i)
    }
  })
})

describe('escala do resultado (só visual)', () => {
  it('a posição vai de 0 a 1 e fica nas pontas para valores fora da escala', () => {
    expect(scalePosition(14)).toBe(0)
    expect(scalePosition(36)).toBe(1)
    expect(scalePosition(5)).toBe(0)
    expect(scalePosition(60)).toBe(1)
    expect(scalePosition(25)).toBeGreaterThan(scalePosition(18.5))
  })

  it('os cortes das faixas ficam em ordem e batem com as faixas do IMC', () => {
    const [a, b, c] = scaleStops()
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
    expect(a).toBeCloseTo((18.5 - 14) / 22, 5)
    expect(c).toBeLessThan(1)
  })
})
