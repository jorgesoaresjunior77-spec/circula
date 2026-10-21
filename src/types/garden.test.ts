import { describe, it, expect } from 'vitest'
import { buildGardenHistory, gardenErrorMessage } from './garden'
import type { GardenShareHistoryRow } from './garden'

/**
 * `buildGardenHistory` é o núcleo da regra de negócio do item 5 ("Meu
 * histórico"): só desafios já ARQUIVADOS, só o compartilhamento mais
 * recente de cada um, e nunca um dado inventado. A filtragem por dono
 * (profile_id) acontece na query do hook (useGardenMember.fetchHistory,
 * `.eq('profile_id', profileId)`), não aqui — estas linhas já chegam
 * restritas à própria participante; esta função só decide
 * arquivado-ou-não e deduplica.
 */
describe('buildGardenHistory', () => {
  function row(overrides: Partial<GardenShareHistoryRow> = {}): GardenShareHistoryRow {
    return {
      challenge_id: 'challenge-1',
      challenge_title: 'Desafio de teste',
      days_completed: 5,
      total_days: 10,
      color_one: 'sage',
      color_two: null,
      created_at: '2026-09-01T00:00:00.000Z',
      ...overrides,
    }
  }

  it('inclui um desafio arquivado (challenge_id fora do conjunto "ainda publicado")', () => {
    const result = buildGardenHistory([row()], new Set())

    expect(result).toEqual([
      {
        challengeId: 'challenge-1',
        challengeTitle: 'Desafio de teste',
        daysCompleted: 5,
        totalDays: 10,
        colorOne: 'sage',
        colorTwo: null,
        lastSharedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
  })

  it('exclui um desafio que ainda está publicado (não é "histórico")', () => {
    const result = buildGardenHistory([row()], new Set(['challenge-1']))

    expect(result).toEqual([])
  })

  it('deduplica: com várias linhas do mesmo desafio arquivado, mantém só a primeira (mais recente, pois a entrada já chega ordenada desc)', () => {
    const result = buildGardenHistory(
      [
        row({ days_completed: 8, created_at: '2026-10-01T00:00:00.000Z' }), // mais recente
        row({ days_completed: 3, created_at: '2026-09-15T00:00:00.000Z' }), // mais antiga — descartada
      ],
      new Set(),
    )

    expect(result).toHaveLength(1)
    expect(result[0].daysCompleted).toBe(8)
    expect(result[0].lastSharedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('mantém desafios arquivados DIFERENTES separados, cada um com seus próprios campos', () => {
    const result = buildGardenHistory(
      [
        row({ challenge_id: 'challenge-a', challenge_title: 'A', days_completed: 2, total_days: 5 }),
        row({ challenge_id: 'challenge-b', challenge_title: 'B', days_completed: 9, total_days: 9 }),
      ],
      new Set(),
    )

    expect(result.map((e) => e.challengeId).sort()).toEqual(['challenge-a', 'challenge-b'])
    const a = result.find((e) => e.challengeId === 'challenge-a')
    const b = result.find((e) => e.challengeId === 'challenge-b')
    expect(a).toMatchObject({ challengeTitle: 'A', daysCompleted: 2, totalDays: 5 })
    expect(b).toMatchObject({ challengeTitle: 'B', daysCompleted: 9, totalDays: 9 })
  })

  it('cenário misto: filtra os publicados e deduplica só entre os arquivados restantes', () => {
    const result = buildGardenHistory(
      [
        row({ challenge_id: 'still-published', created_at: '2026-10-05T00:00:00.000Z' }),
        row({ challenge_id: 'archived-1', days_completed: 4, created_at: '2026-10-04T00:00:00.000Z' }),
        row({ challenge_id: 'archived-1', days_completed: 1, created_at: '2026-10-01T00:00:00.000Z' }),
        row({ challenge_id: 'archived-2', days_completed: 7, created_at: '2026-10-03T00:00:00.000Z' }),
      ],
      new Set(['still-published']),
    )

    expect(result.map((e) => e.challengeId).sort()).toEqual(['archived-1', 'archived-2'])
    expect(result.find((e) => e.challengeId === 'archived-1')?.daysCompleted).toBe(4)
  })

  it('com nenhuma linha, devolve lista vazia (sem inventar nada)', () => {
    expect(buildGardenHistory([], new Set())).toEqual([])
  })

  it('preserva color_one/color_two nulos tal como vieram (não inventa cor)', () => {
    const result = buildGardenHistory([row({ color_one: null, color_two: null })], new Set())

    expect(result[0].colorOne).toBeNull()
    expect(result[0].colorTwo).toBeNull()
  })
})

/**
 * Camada de defesa adicional do item 3 (compartilhamento sem
 * duplicata): mesmo que a UI já remova a opção de compartilhar de
 * novo, se uma chamada duplicada ainda assim chegar ao backend, o erro
 * `already_shared` do RPC `garden_share_completion` precisa virar uma
 * mensagem amigável, não vazar o código cru do Postgres.
 */
describe('gardenErrorMessage — "already_shared" (item 3, defesa em profundidade)', () => {
  it('traduz o erro de conclusão já compartilhada', () => {
    expect(gardenErrorMessage('already_shared')).toBe('Esta conclusão já foi compartilhada no feed.')
  })

  it('reconhece o código mesmo embutido em texto adicional do Postgres/PostgREST', () => {
    expect(gardenErrorMessage('ERROR: raise exception already_shared (SQLSTATE P0001)')).toBe(
      'Esta conclusão já foi compartilhada no feed.',
    )
  })
})
