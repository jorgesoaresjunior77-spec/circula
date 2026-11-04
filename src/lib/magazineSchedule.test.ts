import { describe, expect, it } from 'vitest'
import { daysUntilNextMagazine, nextMagazineMessage, suggestedReleaseDate } from './magazineSchedule'

describe('magazineSchedule', () => {
  it('conta os dias até o próximo dia 01', () => {
    expect(daysUntilNextMagazine(new Date(2026, 10, 4))).toBe(27) // 4/nov -> 1/dez
    expect(daysUntilNextMagazine(new Date(2026, 10, 30))).toBe(1)
  })
  it('no dia 01 a próxima edição é a do mês seguinte', () => {
    expect(daysUntilNextMagazine(new Date(2026, 11, 1))).toBe(31)
  })
  it('mensagem no singular e plural', () => {
    expect(nextMagazineMessage(new Date(2026, 10, 30))).toContain('amanhã')
    expect(nextMagazineMessage(new Date(2026, 10, 4))).toContain('27 dias')
  })
  it('sugere o dia 01 de hoje ou do próximo mês', () => {
    expect(suggestedReleaseDate(new Date(2026, 10, 1))).toBe('2026-11-01')
    expect(suggestedReleaseDate(new Date(2026, 10, 4))).toBe('2026-12-01')
  })
})
