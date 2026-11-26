import { describe, it, expect } from 'vitest'
import { HOLD_S, MOVE_S, SLOTS, STEP, ringAngle, slotPose } from './planCarousel'

const CICLO = HOLD_S + MOVE_S

describe('carrossel dos planos', () => {
  it('começa parado com o primeiro cartão na frente', () => {
    expect(ringAngle(0)).toBe(0)
    expect(ringAngle(HOLD_S - 0.01)).toBe(0)
  })
  it('gira exatamente um passo por ciclo e dá a volta completa em cinco', () => {
    expect(ringAngle(CICLO)).toBeCloseTo(STEP, 9)
    expect(ringAngle(CICLO * SLOTS)).toBeCloseTo(Math.PI * 2, 9)
  })
  it('nunca volta para trás', () => {
    let ant = 0
    for (let t = 0; t < CICLO * 7; t += 0.05) {
      const a = ringAngle(t)
      expect(a).toBeGreaterThanOrEqual(ant - 1e-9)
      ant = a
    }
  })
  it('o cartão da frente tem z máximo e o de trás, mínimo', () => {
    const frente = slotPose(0, 0, 2)
    const tras = slotPose(Math.PI, 0, 2)
    expect(frente.z).toBeCloseTo(2, 9)
    expect(tras.z).toBeCloseTo(-2, 9)
    expect(frente.front).toBeCloseTo(1, 9)
    expect(tras.front).toBeCloseTo(0, 9)
  })
  it('depois de um passo o vizinho da direita chega à frente', () => {
    const p = slotPose(STEP, STEP, 2)
    expect(p.x).toBeCloseTo(0, 9)
    expect(p.z).toBeCloseTo(2, 9)
  })
})
