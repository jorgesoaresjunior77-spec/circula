import { describe, expect, it } from 'vitest'
import { BASE_EXERCISES } from './exerciseCatalog'
import { FAMILIES, cycleMix, mixPose, motionFor } from './exercisePoses'

describe('poses da mulher 3D', () => {
  it('todo exercício do catálogo tem um movimento com início e fim', () => {
    for (const e of BASE_EXERCISES) {
      const { family, motion } = motionFor(e.slug)
      expect(motion, `${e.slug} → ${family}`).toBeDefined()
      expect(motion.a).toBeTypeOf('object')
      expect(motion.b).toBeTypeOf('object')
    }
  })

  it('exercícios que se movem têm seta; isométricos não precisam', () => {
    for (const [name, m] of Object.entries(FAMILIES)) {
      if (!m.hold) expect(m.track, name).toBeDefined()
    }
  })

  it('ciclo: começa e termina na posição inicial e passa pela final (início, desenvolvimento, retorno)', () => {
    expect(cycleMix(0)).toBe(0)
    expect(cycleMix(0.55)).toBe(1)
    expect(cycleMix(0.99)).toBe(0)
    expect(cycleMix(0.3)).toBeGreaterThan(0)
    expect(cycleMix(0.3)).toBeLessThan(1)
    expect(cycleMix(0.5, true)).toBeCloseTo(1)
  })

  it('mistura as poses ângulo a ângulo', () => {
    expect(mixPose({ lKnee: 0 }, { lKnee: 100, spine: 30 }, 0.5)).toEqual({ lKnee: 50, spine: 15 })
  })
})
