import { describe, it, expect } from 'vitest'
import { PINNED_PLACES, diffFromBrasilia, localTime, offsetMinutes, searchPlaces } from './worldClock'

const AT = new Date('2026-07-15T15:00:00Z') // inverno no Brasil, verão na Europa

describe('worldClock', () => {
  it('tem três lugares fixos', () => {
    expect(PINNED_PLACES).toHaveLength(3)
  })

  it('calcula o fuso em minutos', () => {
    expect(offsetMinutes('America/Sao_Paulo', AT)).toBe(-180)
    expect(offsetMinutes('Europe/Lisbon', AT)).toBe(60)
    expect(offsetMinutes('Asia/Kolkata', AT)).toBe(330)
  })

  it('descreve a diferença para Brasília', () => {
    expect(diffFromBrasilia('America/Sao_Paulo', AT)).toBe('mesmo horário de Brasília')
    expect(diffFromBrasilia('Europe/Lisbon', AT)).toBe('4 h a mais que Brasília')
    expect(diffFromBrasilia('America/New_York', AT)).toBe('1 h a menos que Brasília')
    expect(diffFromBrasilia('Asia/Kolkata', AT)).toBe('8h30 a mais que Brasília')
  })

  it('mostra a hora local do lugar', () => {
    expect(localTime('Europe/Lisbon', AT)).toBe('16:00')
    expect(localTime('America/Sao_Paulo', AT)).toBe('12:00')
  })

  it('a busca devolve só lugares com fuso e não chama a rede com menos de 2 letras', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        results: [
          { name: 'Paris', country: 'França', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' },
          { name: 'Sem fuso', latitude: 0, longitude: 0 },
        ],
      }),
    })
    expect(await searchPlaces('p', fetchImpl)).toEqual([])
    const found = await searchPlaces('Paris', fetchImpl)
    expect(found).toHaveLength(1)
    expect(found[0].timezone).toBe('Europe/Paris')
  })
})
