import { describe, it, expect } from 'vitest'
import { getLocalDateParts, localPeriodMonth, GARDEN_DEFAULT_TIMEZONE } from './timezone'

describe('getLocalDateParts', () => {
  it('lê a data no fuso informado, não em UTC nem na hora local da máquina', () => {
    // 2026-11-01T01:30:00Z = 2026-10-31T22:30:00-03:00 em São Paulo.
    expect(getLocalDateParts(new Date('2026-11-01T01:30:00Z'), 'America/Sao_Paulo')).toEqual({
      year: 2026,
      month: 10,
      day: 31,
    })
    // O mesmo instante em UTC puro já é novembro.
    expect(getLocalDateParts(new Date('2026-11-01T01:30:00Z'), 'UTC')).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    })
  })

  it('usa GARDEN_DEFAULT_TIMEZONE quando nenhum fuso é passado', () => {
    const withDefault = getLocalDateParts(new Date('2026-11-01T01:30:00Z'))
    const explicit = getLocalDateParts(new Date('2026-11-01T01:30:00Z'), GARDEN_DEFAULT_TIMEZONE)
    expect(withDefault).toEqual(explicit)
  })
})

describe('localPeriodMonth', () => {
  it('formata YYYY-MM-01 no fuso oficial', () => {
    expect(localPeriodMonth(new Date('2026-11-15T12:00:00Z'))).toBe('2026-11-01')
  })

  it('respeita a virada de mês no horário oficial, não em UTC', () => {
    expect(localPeriodMonth(new Date('2026-11-01T01:30:00Z'))).toBe('2026-10-01')
    expect(localPeriodMonth(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })
})
