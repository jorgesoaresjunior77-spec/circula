import { describe, it, expect } from 'vitest'
import { formatClockDate } from './clockDate'

describe('data curta do relógio', () => {
  it('três letras maiúsculas, dia com dois dígitos e mês abreviado', () => {
    expect(formatClockDate(new Date('2026-11-27T15:00:00Z'), 'America/Sao_Paulo')).toBe('SEX 27 NOV')
    expect(formatClockDate(new Date('2026-12-07T15:00:00Z'), 'America/Sao_Paulo')).toBe('SEG 07 DEZ')
    expect(formatClockDate(new Date('2026-02-01T15:00:00Z'), 'America/Sao_Paulo')).toBe('DOM 01 FEV')
    expect(formatClockDate(new Date('2026-11-28T15:00:00Z'), 'America/Sao_Paulo')).toBe('SÁB 28 NOV')
  })
  it('respeita o fuso: perto da meia-noite muda o dia', () => {
    const at = new Date('2026-11-27T02:30:00Z') // 23:30 de 26/11 em Brasília
    expect(formatClockDate(at, 'America/Sao_Paulo')).toBe('QUI 26 NOV')
    expect(formatClockDate(at, 'Europe/Lisbon')).toBe('SEX 27 NOV')
  })
})
