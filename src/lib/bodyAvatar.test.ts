import { describe, it, expect } from 'vitest'
import { avatarGeometry, ellipseAxes, resolveMeasures } from './bodyAvatar'

describe('ellipseAxes', () => {
  it('uma elipse redonda (razão 1) tem raio = circunferência / 2π', () => {
    const { a, b } = ellipseAxes(62.83, 1)
    expect(a).toBeCloseTo(10, 1)
    expect(b).toBeCloseTo(10, 1)
  })
  it('mantém a razão pedida entre largura e profundidade', () => {
    const { a, b } = ellipseAxes(75, 1.55)
    expect(a / b).toBeCloseTo(1.55, 3)
  })
})

describe('resolveMeasures', () => {
  it('usa proporções médias quando falta a medida e marca como não informada', () => {
    const r = resolveMeasures({ heightCm: 165 })
    expect(r.waist).toBeGreaterThan(60)
    expect(r.provided.waist).toBe(false)
  })
  it('escala as medidas estimadas pelo IMC quando há peso e altura', () => {
    const leve = resolveMeasures({ heightCm: 165, weightKg: 50 })
    const pesada = resolveMeasures({ heightCm: 165, weightKg: 85 })
    expect(pesada.waist).toBeGreaterThan(leve.waist)
  })
  it('respeita a medida informada', () => {
    const r = resolveMeasures({ heightCm: 165, waistCm: 80 })
    expect(r.waist).toBe(80)
    expect(r.provided.waist).toBe(true)
  })
})

describe('avatarGeometry', () => {
  it('gera caminhos nas três vistas', () => {
    for (const v of ['front', 'side', 'back'] as const) {
      const g = avatarGeometry({ heightCm: 165, waistCm: 72, hipCm: 98 }, v)
      expect(g.body.startsWith('M')).toBe(true)
      expect(g.arms.length).toBeGreaterThan(0)
    }
  })
  it('a cintura maior afasta a chamada da cintura do centro', () => {
    const fina = avatarGeometry({ heightCm: 165, waistCm: 66 }, 'front').stations.find((s) => s.key === 'waist')!
    const larga = avatarGeometry({ heightCm: 165, waistCm: 90 }, 'front').stations.find((s) => s.key === 'waist')!
    expect(larga.edgeX).toBeGreaterThan(fina.edgeX)
  })
})
