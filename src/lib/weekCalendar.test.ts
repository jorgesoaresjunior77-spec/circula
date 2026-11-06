import { describe, it, expect } from 'vitest'
import { todayParts, weekDays, weekTitle } from './weekCalendar'

// 5/11/2026 é quinta-feira.
const QUINTA = { year: 2026, month: 11, day: 5 }

describe('weekDays — semana de segunda a domingo', () => {
  it('começa na segunda e termina no domingo', () => {
    const days = weekDays(QUINTA)
    expect(days.map((d) => d.iso)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })

  it('marca só o dia de hoje', () => {
    const days = weekDays(QUINTA)
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(['2026-11-05'])
  })

  it('no domingo, a semana ainda é a que terminou nele (não a seguinte)', () => {
    const days = weekDays({ year: 2026, month: 11, day: 8 })
    expect(days[0].iso).toBe('2026-11-02')
    expect(days[6].iso).toBe('2026-11-08')
    expect(days[6].isToday).toBe(true)
  })

  it('na segunda, a semana começa no próprio dia', () => {
    const days = weekDays({ year: 2026, month: 11, day: 2 })
    expect(days[0].iso).toBe('2026-11-02')
    expect(days[0].isToday).toBe(true)
  })

  it('navega para semanas anteriores e seguintes', () => {
    expect(weekDays(QUINTA, -1)[0].iso).toBe('2026-10-26')
    expect(weekDays(QUINTA, 1)[0].iso).toBe('2026-11-09')
    expect(weekDays(QUINTA, -1).some((d) => d.isToday)).toBe(false)
  })

  it('atravessa a virada de mês e de ano sem errar os dias', () => {
    const mes = weekDays({ year: 2026, month: 10, day: 29 })
    expect(mes.map((d) => d.day)).toEqual([26, 27, 28, 29, 30, 31, 1])
    expect(mes[6].month).toBe(11)

    const ano = weekDays({ year: 2026, month: 12, day: 31 })
    expect(ano.map((d) => d.iso)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
  })

  it('fevereiro de ano bissexto tem 29 dias', () => {
    const days = weekDays({ year: 2028, month: 2, day: 28 })
    expect(days.map((d) => d.iso)).toContain('2028-02-29')
  })
})

describe('weekTitle — mês e ano da primeira linha', () => {
  it('semana dentro de um mês', () => {
    expect(weekTitle(weekDays(QUINTA))).toBe('Novembro 2026')
  })

  it('semana que atravessa dois meses', () => {
    expect(weekTitle(weekDays({ year: 2026, month: 10, day: 29 }))).toBe('Outubro · Novembro 2026')
  })

  it('semana que atravessa o ano', () => {
    expect(weekTitle(weekDays({ year: 2026, month: 12, day: 31 }))).toBe(
      'Dezembro 2026 · Janeiro 2027',
    )
  })
})

describe('todayParts — usa o fuso de São Paulo, não o do aparelho', () => {
  it('01:00 UTC ainda é o dia anterior em São Paulo', () => {
    expect(todayParts(new Date('2026-11-06T01:00:00Z'))).toEqual({ year: 2026, month: 11, day: 5 })
  })

  it('12:00 UTC já é o mesmo dia', () => {
    expect(todayParts(new Date('2026-11-06T12:00:00Z'))).toEqual({ year: 2026, month: 11, day: 6 })
  })
})
