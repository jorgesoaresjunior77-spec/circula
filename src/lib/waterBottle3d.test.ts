import { describe, it, expect } from 'vitest'
import {
  INNER_PROFILE,
  OUTER_PROFILE,
  WATER_BOTTOM_Y,
  WATER_FULL_Y,
  easeToward,
  innerRadiusAt,
  shouldUse3D,
  stepSlosh,
  volumeUpTo,
  waterTopY,
} from './waterBottle3d'

describe('formato da garrafa', () => {
  it('a silhueta sobe da base à boca e o interior cabe dentro do exterior', () => {
    const ys = OUTER_PROFILE.map(([, y]) => y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    INNER_PROFILE.forEach(([r, y], i) => {
      expect(r).toBeLessThanOrEqual(OUTER_PROFILE[i][0])
      expect(y).toBeGreaterThanOrEqual(OUTER_PROFILE[i][1])
    })
  })

  it('o raio interno interpola entre os pontos e fecha no eixo na base', () => {
    expect(innerRadiusAt(WATER_BOTTOM_Y - 1)).toBe(INNER_PROFILE[0][0])
    expect(innerRadiusAt(-0.2)).toBeGreaterThan(0.6)
    expect(innerRadiusAt(WATER_FULL_Y)).toBeLessThan(innerRadiusAt(-0.2))
  })
})

describe('nível da água a partir do dado real', () => {
  it('0% fica no fundo e 100% na altura de cheia', () => {
    expect(waterTopY(0)).toBe(WATER_BOTTOM_Y)
    expect(waterTopY(1)).toBe(WATER_FULL_Y)
    expect(waterTopY(-3)).toBe(WATER_BOTTOM_Y)
    expect(waterTopY(7)).toBe(WATER_FULL_Y)
  })

  it('sobe sempre que o progresso aumenta', () => {
    let last = waterTopY(0)
    for (let p = 0.05; p <= 1; p += 0.05) {
      const y = waterTopY(p)
      expect(y).toBeGreaterThan(last)
      last = y
    }
  })

  it('é calculado pelo volume: a metade da água fica abaixo da metade da altura (o gargalo é estreito)', () => {
    const middleByHeight = (WATER_BOTTOM_Y + WATER_FULL_Y) / 2
    expect(waterTopY(0.5)).toBeLessThan(middleByHeight)
    // E o volume ali é mesmo a metade do volume de cheia.
    const half = volumeUpTo(waterTopY(0.5))
    const full = volumeUpTo(WATER_FULL_Y)
    expect(half / full).toBeCloseTo(0.5, 2)
  })

  it('500, 1000 e 2000 ml de uma meta de 2000 ml dão 25%, 50% e 100% do volume', () => {
    const full = volumeUpTo(WATER_FULL_Y)
    for (const [ml, goal] of [[500, 2000], [1000, 2000], [2000, 2000]] as const) {
      const p = ml / goal
      expect(volumeUpTo(waterTopY(p)) / full).toBeCloseTo(p, 2)
    }
  })
})

describe('movimento da água', () => {
  it('a suavização anda em direção ao alvo sem passar dele e chega nele', () => {
    let v = 0
    for (let i = 0; i < 300; i += 1) {
      const next = easeToward(v, 1, 1 / 60)
      expect(next).toBeGreaterThanOrEqual(v)
      expect(next).toBeLessThanOrEqual(1)
      v = next
    }
    expect(v).toBe(1)
    expect(easeToward(0.3, 1, 0)).toBe(0.3)
  })

  it('a água balança ao receber um impulso e se acalma sozinha', () => {
    let s = stepSlosh({ x: 0, v: 0 }, 1 / 60, 0.8)
    let swung = false
    for (let i = 0; i < 600; i += 1) {
      s = stepSlosh(s, 1 / 60)
      if (Math.abs(s.x) > 0.001) swung = true
    }
    expect(swung).toBe(true)
    expect(s).toEqual({ x: 0, v: 0 })
  })
})

describe('3D ou SVG', () => {
  const ok = { reducedMotion: false, hasWebGL: true }

  it('usa 3D em aparelho normal com WebGL', () => {
    expect(shouldUse3D(ok)).toBe(true)
  })

  it('cai no SVG sem WebGL, com movimento reduzido, economia de dados ou aparelho fraco', () => {
    expect(shouldUse3D({ ...ok, hasWebGL: false })).toBe(false)
    expect(shouldUse3D({ ...ok, reducedMotion: true })).toBe(false)
    expect(shouldUse3D({ ...ok, saveData: true })).toBe(false)
    expect(shouldUse3D({ ...ok, deviceMemory: 2 })).toBe(false)
    expect(shouldUse3D({ ...ok, hardwareConcurrency: 2 })).toBe(false)
  })

  it('o ajuste guardado no aparelho vale, mas 3D nunca ignora a falta de WebGL', () => {
    expect(shouldUse3D({ ...ok, force: 'svg' })).toBe(false)
    expect(shouldUse3D({ ...ok, reducedMotion: true, force: '3d' })).toBe(true)
    expect(shouldUse3D({ ...ok, hasWebGL: false, force: '3d' })).toBe(false)
  })
})
