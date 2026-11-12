import { describe, it, expect } from 'vitest'
import { sunHeight, sunProgress, sunflowerTilt } from './sunPosition'

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m)

describe('sunPosition', () => {
  it('de noite não há sol', () => {
    expect(sunProgress(at(3))).toBeNull()
    expect(sunProgress(at(22))).toBeNull()
  })

  it('o sol vai de 0 (nascer) a 1 (pôr), 0,5 ao meio-dia', () => {
    expect(sunProgress(at(6))).toBe(0)
    expect(sunProgress(at(12))).toBe(0.5)
    expect(sunProgress(at(18))).toBe(1)
  })

  it('o sol é mais alto ao meio-dia', () => {
    expect(sunHeight(0)).toBeCloseTo(0)
    expect(sunHeight(0.5)).toBeCloseTo(1)
    expect(sunHeight(1)).toBeCloseTo(0)
  })

  it('o girassol vira para a esquerda de manhã, para a direita à tarde e ergue o rosto ao meio-dia', () => {
    const morning = sunflowerTilt(0)
    const noon = sunflowerTilt(0.5)
    const evening = sunflowerTilt(1)
    expect(morning.rotateY).toBeLessThan(0)
    expect(evening.rotateY).toBeGreaterThan(0)
    expect(noon.rotateY).toBe(0)
    expect(noon.rotateX).toBeLessThan(morning.rotateX)
  })

  it('de noite fica de frente, levemente abaixado', () => {
    expect(sunflowerTilt(null)).toEqual({ rotateX: 16, rotateY: 0 })
  })
})
