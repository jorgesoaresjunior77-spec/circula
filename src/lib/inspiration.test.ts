import { describe, it, expect, afterEach, vi } from 'vitest'
import { attribution, dayNumber, markSeenToday, pickInspiration, wasSeenToday } from './inspiration'
import type { Inspiration } from './inspiration'

function item(id: string, over: Partial<Inspiration> = {}): Inspiration {
  return {
    id,
    community_id: 'c1',
    kind: 'editorial',
    body: `texto ${id}`,
    author: null,
    source: null,
    status: 'published',
    created_at: `2026-01-0${id}T00:00:00Z`,
    ...over,
  }
}

describe('pickInspiration — a mensagem do dia', () => {
  it('sem mensagem publicada, não há pop-up (nada é inventado)', () => {
    expect(pickInspiration([], '2026-11-05')).toBeNull()
    expect(pickInspiration([item('1', { status: 'draft' })], '2026-11-05')).toBeNull()
  })

  it('ignora rascunhos', () => {
    const only = item('2')
    expect(pickInspiration([item('1', { status: 'draft' }), only], '2026-11-05')).toBe(only)
  })

  it('é a mesma mensagem durante o dia todo, para todo mundo', () => {
    const list = [item('1'), item('2'), item('3')]
    expect(pickInspiration(list, '2026-11-05')?.id).toBe(pickInspiration([...list].reverse(), '2026-11-05')?.id)
  })

  it('gira pela lista, uma por dia, e volta ao começo', () => {
    const list = [item('1'), item('2'), item('3')]
    const ids = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map(
      (d) => pickInspiration(list, d)?.id,
    )
    expect(new Set(ids.slice(0, 3)).size).toBe(3)
    expect(ids[3]).toBe(ids[0])
  })
})

describe('dayNumber', () => {
  it('dias consecutivos diferem em 1', () => {
    expect(dayNumber('2026-11-06') - dayNumber('2026-11-05')).toBe(1)
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1)
  })
})

describe('attribution', () => {
  it('citação mostra autor e obra; texto editorial leva o selo do Círcula', () => {
    expect(attribution(item('1', { kind: 'citacao', author: 'Autora', source: 'Obra' }))).toBe('Autora, Obra')
    expect(attribution(item('1'))).toBe('Texto editorial do Círcula')
  })
})

describe('wasSeenToday / markSeenToday', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('mostra uma vez por dia por pessoa', () => {
    expect(wasSeenToday('u1', '2026-11-05')).toBe(false)
    markSeenToday('u1', '2026-11-05')
    expect(wasSeenToday('u1', '2026-11-05')).toBe(true)
    expect(wasSeenToday('u1', '2026-11-06')).toBe(false)
    expect(wasSeenToday('u2', '2026-11-05')).toBe(false)
  })

  it('sem armazenamento disponível, não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(() => markSeenToday('u1', '2026-11-05')).not.toThrow()
    expect(wasSeenToday('u1', '2026-11-05')).toBe(false)
  })
})
