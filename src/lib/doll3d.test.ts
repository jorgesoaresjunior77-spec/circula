import { describe, it, expect } from 'vitest'
import { BAND_WIDTH, HABIT_KEYS, dressProfile, grayMix, propTargets, waistRadius } from './doll3d'
import { HABITS } from './habits'

describe('grayMix — a boneca ganha cor aos poucos', () => {
  it('1 = a cor original; 0 = preto e branco (os três canais iguais)', () => {
    expect(grayMix(0xe58a8a, 1)).toBe(0xe58a8a)
    const gray = grayMix(0xe58a8a, 0)
    expect((gray >> 16) & 255).toBe((gray >> 8) & 255)
    expect((gray >> 8) & 255).toBe(gray & 255)
  })

  it('no meio do caminho fica entre o cinza e a cor, e valores fora de 0..1 são limitados', () => {
    const half = grayMix(0xff0000, 0.5)
    const red = (half >> 16) & 255
    expect(red).toBeGreaterThan(grayMix(0xff0000, 0) >> 16 & 255)
    expect(red).toBeLessThan(255)
    expect(grayMix(0x6b4226, 7)).toBe(0x6b4226)
    expect(grayMix(0x6b4226, -3)).toBe(grayMix(0x6b4226, 0))
  })

  it('branco e preto não mudam (já são cinza)', () => {
    expect(grayMix(0xffffff, 0)).toBe(0xffffff)
    expect(grayMix(0x000000, 0.3)).toBe(0x000000)
  })
})

describe('adereços dos hábitos', () => {
  it('os 7 hábitos da boneca são exatamente os de lib/habits', () => {
    expect([...HABIT_KEYS].sort()).toEqual(HABITS.map((h) => h.key).sort())
  })

  it('cada adereço acende só se o hábito foi marcado', () => {
    const t = propTargets(new Set(['agua', 'leitura']))
    expect(t.agua).toBe(1)
    expect(t.leitura).toBe(1)
    expect(t.luz).toBe(0)
    expect(Object.values(t).filter((v) => v === 1)).toHaveLength(2)
    expect(Object.values(propTargets(new Set())).every((v) => v === 0)).toBe(true)
  })
})

describe('formato do vestido', () => {
  it('a altura sobe de baixo para cima e o vestido fecha no eixo nas duas pontas', () => {
    const p = dressProfile(1)
    const ys = p.map(([, y]) => y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    expect(p[0][0]).toBeLessThan(0.05)
    expect(p[p.length - 1][0]).toBeLessThan(0.05)
  })

  it('a cintura e o quadril acompanham a faixa do IMC; os ombros não mudam', () => {
    expect(waistRadius(BAND_WIDTH.abaixo)).toBeLessThan(waistRadius(BAND_WIDTH.referencia))
    expect(waistRadius(BAND_WIDTH.referencia)).toBeLessThan(waistRadius(BAND_WIDTH.acima))
    expect(waistRadius(BAND_WIDTH.acima)).toBeLessThan(waistRadius(BAND_WIDTH.elevado))
    const shoulders = (f: number) => dressProfile(f)[7][0]
    expect(shoulders(0.86)).toBe(shoulders(1.3))
  })
})
