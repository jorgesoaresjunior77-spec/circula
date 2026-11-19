import { describe, expect, it } from 'vitest'
import { amenMessage, prayerOfTheDay, streak } from './gratitude'

const p = (id: string, position: number, status = 'published') => ({ id, position, status })

describe('Diário da Gratidão', () => {
  it('escolhe a mesma oração o dia todo e muda no dia seguinte', () => {
    const list = [p('a', 1), p('b', 2), p('c', 3)]
    const d1 = prayerOfTheDay(list, '2026-11-19')
    expect(prayerOfTheDay(list, '2026-11-19')).toBe(d1)
    expect(prayerOfTheDay(list, '2026-11-20')?.id).not.toBe(d1?.id)
  })
  it('ignora rascunhos e devolve nulo sem orações publicadas', () => {
    expect(prayerOfTheDay([p('a', 1, 'draft')], '2026-11-19')).toBeNull()
    expect(prayerOfTheDay([], '2026-11-19')).toBeNull()
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
