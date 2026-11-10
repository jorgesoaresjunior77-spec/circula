import { describe, it, expect } from 'vitest'
import {
  MAG_MAX_ZOOM,
  MAG_VIEW_RESET,
  castShade,
  clampView,
  clampZoom,
  dragFraction,
  flapAngle,
  flapShade,
  pointDistance,
  settleMs,
  shouldComplete,
  snapView,
  turnProgress,
  viewForPinch,
} from './magazineGestures'

describe('zoom por pinça', () => {
  it('limita o zoom entre 1 e o máximo', () => {
    expect(clampZoom(0.4)).toBe(1)
    expect(clampZoom(2.2)).toBe(2.2)
    expect(clampZoom(9)).toBe(MAG_MAX_ZOOM)
  })

  it('mede a distância entre os dois dedos', () => {
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('a página fica sob o dedo ao ampliar (ponto de ancoragem não se mexe)', () => {
    // Dedos no ponto (50, -30) em relação ao centro; amplia de 1x para 2x.
    const mid = { x: 50, y: -30 }
    const v = viewForPinch(MAG_VIEW_RESET, mid, 2, mid)
    expect(v.z).toBe(2)
    // O ponto de página sob o dedo continua em (50, -30): tx = 50 - 50*2 = -50.
    expect(v.tx).toBe(-50)
    expect(v.ty).toBe(30)
  })

  it('acompanha o movimento dos dedos durante a pinça', () => {
    const start = { x: 0, y: 0 }
    const moved = viewForPinch(MAG_VIEW_RESET, start, 1.5, { x: 20, y: 10 })
    expect(moved.tx).toBe(20)
    expect(moved.ty).toBe(10)
  })

  it('não deixa arrastar a página para fora e centraliza quando cabe', () => {
    // Folha 300x400 numa área 360x700: a 2x passa da largura (600 > 360), mas não da altura (800 > 700 sim).
    const v = clampView({ z: 2, tx: 999, ty: -999 }, 300, 400, 360, 700)
    expect(v.tx).toBe((300 * 2 - 360) / 2)
    expect(v.ty).toBe(-((400 * 2 - 700) / 2))
    // Sem zoom, a folha cabe: fica no centro.
    expect(clampView({ z: 1, tx: 50, ty: 50 }, 300, 400, 360, 700)).toEqual({ z: 1, tx: 0, ty: 0 })
  })

  it('perto de 1x volta exatamente para 1x', () => {
    expect(snapView({ z: 1.03, tx: 9, ty: 9 })).toEqual(MAG_VIEW_RESET)
    expect(snapView({ z: 1.5, tx: 9, ty: 9 }).z).toBe(1.5)
  })
})

describe('virada de página', () => {
  it('avançar: a folha sai de 0 (deitada) até 1 (virada)', () => {
    expect(turnProgress('next', 0)).toBe(0)
    expect(turnProgress('next', 0.5)).toBe(0.5)
    expect(turnProgress('next', 1)).toBe(1)
  })

  it('voltar: a folha da página anterior vem de 1 até 0', () => {
    expect(turnProgress('prev', 0)).toBe(1)
    expect(turnProgress('prev', 1)).toBe(0)
  })

  it('a fração do arrasto vale só na direção da virada', () => {
    expect(dragFraction('next', -150, 300)).toBe(0.5)
    expect(dragFraction('next', 150, 300)).toBe(0)
    expect(dragFraction('prev', 150, 300)).toBe(0.5)
    expect(dragFraction('prev', -40, 300)).toBe(0)
    expect(dragFraction('next', -900, 300)).toBe(1)
    expect(dragFraction('next', -10, 0)).toBe(0)
  })

  it('completa se foi longe ou rápido; senão volta', () => {
    expect(shouldComplete(0.4, 0)).toBe(true)
    expect(shouldComplete(0.1, 0.8)).toBe(true)
    expect(shouldComplete(0.1, 0.1)).toBe(false)
    expect(shouldComplete(0.2, -0.9)).toBe(false)
  })

  it('o ângulo e as sombras acompanham o progresso', () => {
    expect(flapAngle(0)).toBeCloseTo(0)
    expect(flapAngle(1)).toBe(-170)
    expect(flapShade(0)).toBe(0)
    expect(flapShade(1)).toBeCloseTo(0.7)
    // A sombra na página de baixo é maior no meio e some nas pontas.
    expect(castShade(0)).toBeCloseTo(0)
    expect(castShade(0.5)).toBeGreaterThan(castShade(0.1))
    expect(castShade(1)).toBeCloseTo(0, 5)
  })

  it('a duração é curta (nunca mais de meio segundo) e proporcional ao que falta', () => {
    expect(settleMs(0, 1)).toBeLessThanOrEqual(460)
    expect(settleMs(0.9, 1)).toBe(220)
    expect(settleMs(0.5, 1)).toBeLessThan(settleMs(0, 1))
  })
})
