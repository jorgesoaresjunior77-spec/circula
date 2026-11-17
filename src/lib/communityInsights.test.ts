import { describe, expect, it } from 'vitest'
import { countByDay, lastDays, percentChange, share, topItems, weeklyGrowth } from './communityInsights'

const TODAY = new Date(2026, 10, 18) // quarta, 18/11/2026

describe('lastDays', () => {
  it('lista os dias terminando hoje, do mais antigo ao mais novo', () => {
    expect(lastDays(3, TODAY)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18'])
  })
})

describe('countByDay', () => {
  it('conta só o que casa e cai dentro dos dias', () => {
    const days = lastDays(2, TODAY)
    const rows = [
      { kind: 'magazine', item_id: 'a', profile_id: 'p1', created_at: new Date(2026, 10, 18, 9).toISOString() },
      { kind: 'partner_click', item_id: 'b', profile_id: 'p1', created_at: new Date(2026, 10, 17, 9).toISOString() },
      { kind: 'magazine', item_id: 'a', profile_id: 'p2', created_at: new Date(2026, 9, 1, 9).toISOString() },
    ]
    expect(countByDay(rows, days, (r) => r.kind === 'magazine')).toEqual([0, 1])
    expect(countByDay(rows, days, (r) => r.kind === 'partner_click')).toEqual([1, 0])
  })
})

describe('percentChange', () => {
  it('calcula a variação e devolve null sem base', () => {
    expect(percentChange(15, 10)).toBe(50)
    expect(percentChange(5, 10)).toBe(-50)
    expect(percentChange(5, 0)).toBeNull()
  })
})

describe('weeklyGrowth', () => {
  it('soma as entradas por semana e acumula o total', () => {
    const joined = [
      new Date(2026, 10, 1).toISOString(), // antes da janela de 2 semanas
      new Date(2026, 10, 10, 12).toISOString(), // semana de 09/11
      new Date(2026, 10, 17, 12).toISOString(), // semana de 16/11
      new Date(2026, 10, 18, 12).toISOString(), // semana de 16/11
    ]
    const w = weeklyGrowth(joined, 2, TODAY)
    expect(w.map((x) => x.label)).toEqual(['09/11', '16/11'])
    expect(w.map((x) => x.joined)).toEqual([1, 2])
    expect(w.map((x) => x.total)).toEqual([2, 4])
  })
})

describe('topItems e share', () => {
  it('ordena por aberturas e conta pessoas diferentes', () => {
    const rows = [
      { kind: 'magazine', item_id: 'a', profile_id: 'p1', created_at: '' },
      { kind: 'magazine', item_id: 'a', profile_id: 'p1', created_at: '' },
      { kind: 'recipe', item_id: 'b', profile_id: 'p2', created_at: '' },
    ]
    expect(topItems(rows, 5)).toEqual([
      { kind: 'magazine', item_id: 'a', views: 2, viewers: 1 },
      { kind: 'recipe', item_id: 'b', views: 1, viewers: 1 },
    ])
    expect(share(1, 4)).toBe(25)
    expect(share(1, 0)).toBe(0)
  })
})
