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

  it('mensagem automática entra no sorteio sem ser publicada', () => {
    const auto = item('3', { status: 'auto' })
    expect(pickInspiration([item('1', { status: 'draft' }), auto], '2026-11-05')).toBe(auto)
  })

  it('ignora rascunhos', () => {
    const only = item('2')
    expect(pickInspiration([item('1', { status: 'draft' }), only], '2026-11-05')).toBe(only)
  })

  it('é a mesma mensagem durante o dia todo, para todo mundo', () => {
    const list = [item('1'), item('2'), item('3')]
    expect(pickInspiration(list, '2026-11-05')?.id).toBe(pickInspiration([...list].reverse(), '2026-11-05')?.id)
  })

  it('sorteia sem repetir: numa rodada de N dias aparecem as N mensagens', () => {
    const list = [item('1'), item('2'), item('3')]
    // Começa num dia em que a rodada recomeça (dia múltiplo de 3).
    let start = dayNumber('2026-11-05')
    while (start % 3 !== 0) start += 1
    const iso = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10)
    const ids = [0, 1, 2].map((k) => pickInspiration(list, iso(start + k))?.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('a ordem muda de uma rodada para a outra (não é sempre a mesma sequência)', () => {
    const list = Array.from({ length: 8 }, (_, i) => item(String(i + 1)))
    const iso = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10)
    let start = dayNumber('2026-11-05')
    while (start % 8 !== 0) start += 1
    const round = (r: number) =>
      Array.from({ length: 8 }, (_, k) => pickInspiration(list, iso(start + r * 8 + k))?.id).join(',')
    const rounds = [0, 1, 2, 3].map(round)
    expect(new Set(rounds).size).toBeGreaterThan(1)
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
