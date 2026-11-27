import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_FALLS, missedDays, readSeenFalls, saveSeenFalls, splitFalls } from './gardenFall'

describe('pétala que cai', () => {
  beforeEach(() => localStorage.clear())

  it('hoje ainda não conta como dia perdido', () => {
    expect(missedDays(5, 30, new Set([1, 3]))).toEqual([2, 4])
    expect(missedDays(1, 30, new Set())).toEqual([])
  })

  it('o dia sem check cai uma vez e depois fica caído', () => {
    const missed = missedDays(4, 30, new Set([1, 2]))
    let r = splitFalls(missed, readSeenFalls('p', 'm'))
    expect([...r.falling]).toEqual([3])
    expect(r.gone.size).toBe(0)
    saveSeenFalls('p', 'm', r.falling)
    r = splitFalls(missed, readSeenFalls('p', 'm'))
    expect(r.falling.size).toBe(0)
    expect([...r.gone]).toEqual([3])
  })

  it('voltando depois de muitos dias, só os últimos caem na tela', () => {
    const missed = missedDays(12, 30, new Set())
    const r = splitFalls(missed, new Set())
    expect(r.falling.size).toBe(MAX_FALLS)
    expect([...r.falling]).toEqual([8, 9, 10, 11])
    expect(r.gone.has(1)).toBe(true)
  })

  it('o registro é por pessoa e por mês', () => {
    saveSeenFalls('p', 'm1', [2])
    expect(readSeenFalls('p', 'm2').size).toBe(0)
    expect(readSeenFalls('outra', 'm1').size).toBe(0)
  })
})
