import { describe, expect, it } from 'vitest'
import { itemsByDay, monthGrid, monthKey, monthSummary } from './contentSchedule'
import type { ScheduleItem } from './contentSchedule'

const item = (over: Partial<ScheduleItem>): ScheduleItem => ({
  id: 'x',
  community_id: 'c',
  content_type: 'revista',
  phase: 'publicacao',
  title: 't',
  notes: null,
  scheduled_on: '2026-11-18',
  done: false,
  ...over,
})

describe('calendário mensal', () => {
  it('monta semanas completas de domingo a sábado', () => {
    const weeks = monthGrid(2026, 10) // novembro/2026 começa num domingo
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0][0]).toEqual({ iso: '2026-11-01', day: 1 })
    expect(weeks.flat().filter((c) => c.iso).length).toBe(30)
  })

  it('agrupa por dia e resume produção x publicação', () => {
    const items = [
      item({ id: '1', phase: 'producao', scheduled_on: '2026-11-10' }),
      item({ id: '2', phase: 'publicacao', scheduled_on: '2026-11-18' }),
      item({ id: '3', phase: 'publicacao', scheduled_on: '2026-11-18' }),
      item({ id: '4', scheduled_on: '2026-12-01' }),
    ]
    expect(itemsByDay(items)['2026-11-18']).toHaveLength(2)
    expect(monthSummary(items, monthKey(2026, 10))).toEqual({ productionDays: 1, publishDays: 1, total: 3 })
  })
})
