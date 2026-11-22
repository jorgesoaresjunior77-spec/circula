import { describe, expect, it } from 'vitest'
import { TRACKED_SCREENS, screenId, screenLabelById } from './screens'

describe('screens', () => {
  it('cada área tem um id único e válido', () => {
    const ids = TRACKED_SCREENS.map((s) => screenId(s.key))
    expect(new Set(ids).size).toBe(TRACKED_SCREENS.length)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('vai e volta entre chave e nome', () => {
    expect(screenLabelById(screenId('viagens')!)).toBe('Dicas de Viagem')
    expect(screenId('nao-existe')).toBeNull()
  })
})
