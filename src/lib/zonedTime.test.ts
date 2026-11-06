import { describe, it, expect } from 'vitest'
import { utcToZoned, zonedToUtcIso } from './zonedTime'

describe('zonedTime — hora de parede de São Paulo <-> UTC', () => {
  it('09:00 em São Paulo (UTC-3) é 12:00 UTC', () => {
    expect(zonedToUtcIso('2026-11-05', '09:00')).toBe('2026-11-05T12:00:00.000Z')
  })

  it('23:30 em São Paulo já é o dia seguinte em UTC', () => {
    expect(zonedToUtcIso('2026-11-05', '23:30')).toBe('2026-11-06T02:30:00.000Z')
  })

  it('00:00 do dia é a fronteira do dia em São Paulo, não em UTC', () => {
    expect(zonedToUtcIso('2026-11-05', '00:00')).toBe('2026-11-05T03:00:00.000Z')
  })

  it('volta ao mesmo dia e hora (ida e volta)', () => {
    const iso = zonedToUtcIso('2026-12-31', '22:15')
    expect(utcToZoned(iso)).toEqual({ date: '2026-12-31', time: '22:15' })
  })

  it('02:00 UTC ainda é o dia anterior em São Paulo', () => {
    expect(utcToZoned('2026-11-06T02:00:00.000Z')).toEqual({ date: '2026-11-05', time: '23:00' })
  })

  it('funciona em fuso com horário de verão (Nova York)', () => {
    // 15/07: UTC-4. 15/01: UTC-5.
    expect(zonedToUtcIso('2026-07-15', '12:00', 'America/New_York')).toBe('2026-07-15T16:00:00.000Z')
    expect(zonedToUtcIso('2026-01-15', '12:00', 'America/New_York')).toBe('2026-01-15T17:00:00.000Z')
  })
})
