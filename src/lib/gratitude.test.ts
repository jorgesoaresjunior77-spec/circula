import { describe, expect, it } from 'vitest'
import { BUILTIN_PRAYERS, amenMessage, prayerOfTheDay, streak, topGratitudes } from './gratitude'

const p = (id: string, position: number, status = 'published') => ({ id, position, status })

describe('Diário da Gratidão', () => {
  it('escolhe a mesma oração o dia todo e varia ao longo dos dias', () => {
    const d1 = prayerOfTheDay(BUILTIN_PRAYERS, '2026-11-19')
    expect(prayerOfTheDay(BUILTIN_PRAYERS, '2026-11-19')).toBe(d1)
    const seen = new Set(Array.from({ length: 30 }, (_, i) => prayerOfTheDay(BUILTIN_PRAYERS, `2026-12-${String(i + 1).padStart(2, '0')}`)?.id))
    expect(seen.size).toBeGreaterThanOrEqual(6)
    expect(prayerOfTheDay(BUILTIN_PRAYERS, '2026-11-19', 1)?.id).not.toBe(d1?.id)
  })
  it('as orações tradicionais têm texto e terminam em amém', () => {
    expect(BUILTIN_PRAYERS.length).toBeGreaterThanOrEqual(10)
    for (const b of BUILTIN_PRAYERS) expect(b.body.trim().endsWith('Amém.')).toBe(true)
  })
  it('ignora rascunhos e devolve nulo sem orações publicadas', () => {
    expect(prayerOfTheDay([p('a', 1, 'draft')], '2026-11-19')).toBeNull()
    expect(prayerOfTheDay([], '2026-11-19')).toBeNull()
  })
  it('conta os temas mais agradecidos no período', () => {
    const e = [
      { day: '2026-11-02', items: ['Minha família', 'Saúde'] },
      { day: '2026-11-09', items: ['minha familia', 'O sol'] },
      { day: '2026-10-30', items: ['Saúde'] },
    ]
    expect(topGratitudes(e, '2026-11')[0]).toEqual({ label: 'Minha família', count: 2 })
    expect(topGratitudes(e, '2026').find((x) => x.label === 'Saúde')?.count).toBe(2)
    expect(topGratitudes(e, '2025')).toEqual([])
  })
  it('conta dias seguidos', () => {
    expect(streak(['2026-11-19', '2026-11-18', '2026-11-17'], '2026-11-19')).toBe(3)
    expect(streak(['2026-11-18', '2026-11-17'], '2026-11-19')).toBe(2)
    expect(streak(['2026-11-15'], '2026-11-19')).toBe(0)
  })
  it('a mensagem do amém é estável no dia', () => {
    expect(amenMessage('2026-11-19')).toBe(amenMessage('2026-11-19'))
  })
})
