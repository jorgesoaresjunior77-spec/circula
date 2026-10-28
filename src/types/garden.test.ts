import { describe, it, expect } from 'vitest'
import {
  buildGardenHistory,
  gardenErrorMessage,
  computeGardenJourneyStats,
  formatGardenJourneySummary,
} from './garden'
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

/**
 * Etapa AD — códigos levantados por `garden_publish_challenge`
 * (`garden_generate_challenge_days` também levanta os 3 primeiros) e
 * devolvidos como `rpcError.message` ao hook. Mesma defesa em
 * profundidade do bloco "already_shared" acima: confirma que cada
 * `raise exception '<codigo>'` do Postgres chega como mensagem amigável
 * à profissional, nunca o código cru — tanto puro quanto embutido no
 * texto adicional que o PostgREST costuma anexar.
 */
describe('gardenErrorMessage — códigos de publicação de desafio (Etapa AD)', () => {
  it('traduz "challenge_not_found"', () => {
    expect(gardenErrorMessage('challenge_not_found')).toBe('Desafio não encontrado.')
  })

  it('traduz "not_authorized"', () => {
    expect(gardenErrorMessage('not_authorized')).toBe('Você não tem permissão para esta ação.')
  })

  it('traduz "challenge_not_draft"', () => {
    expect(gardenErrorMessage('challenge_not_draft')).toBe(
      'Só é possível fazer isso enquanto o desafio está em rascunho.',
    )
  })

  it('traduz "challenge_has_no_days"', () => {
    expect(gardenErrorMessage('challenge_has_no_days')).toBe('Cadastre pelo menos um dia antes de publicar.')
  })

  it('reconhece cada código mesmo embutido no texto adicional do Postgres/PostgREST', () => {
    expect(gardenErrorMessage('ERROR: raise exception challenge_has_no_days (SQLSTATE P0001)')).toBe(
      'Cadastre pelo menos um dia antes de publicar.',
    )
    expect(gardenErrorMessage('ERROR: raise exception not_authorized (SQLSTATE P0001)')).toBe(
      'Você não tem permissão para esta ação.',
    )
  })
})

/**
 * Etapa AD — comportamento de fallback: nenhum destes casos pode nunca
 * vazar um código cru ou travar sem mensagem nenhuma.
 */
describe('gardenErrorMessage — fallback para mensagens desconhecidas (Etapa AD)', () => {
  it('mensagem padrão para um código que não está no mapa', () => {
    expect(gardenErrorMessage('algum_erro_nao_mapeado')).toBe(
      'Não foi possível concluir a ação agora. Tente novamente.',
    )
  })

  it('mensagem padrão para string vazia', () => {
    expect(gardenErrorMessage('')).toBe('Não foi possível concluir a ação agora. Tente novamente.')
  })

  it('mensagem padrão para null', () => {
    expect(gardenErrorMessage(null)).toBe('Não foi possível concluir a ação agora. Tente novamente.')
  })

  it('mensagem padrão para undefined', () => {
    expect(gardenErrorMessage(undefined)).toBe('Não foi possível concluir a ação agora. Tente novamente.')
  })
})

/**
 * `computeGardenJourneyStats` — Camada 2 da roda (Etapa N), "jornada
 * acumulada". Função pura: nunca toca Supabase, recebe só o que o hook
 * já teria em mãos sem nenhuma consulta nova. Cobre explicitamente a
 * regra "não contar a mesma conclusão duas vezes" e a limitação
 * documentada (desafio arquivado nunca compartilhado não entra na soma).
 */
describe('computeGardenJourneyStats', () => {
  it('soma 1 dia por conclusão viva, sem desafio concluído quando o total do desafio é desconhecido', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [{ challenge_id: 'c1' }, { challenge_id: 'c1' }],
      liveTotalDaysByChallenge: {}, // desafio nunca aberto — total desconhecido
      historyEntries: [],
    })

    expect(result).toEqual({ totalDaysCompleted: 2, challengesFinished: 0 })
  })

  it('conta um desafio ao vivo como concluído só quando completed >= total conhecido', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [{ challenge_id: 'c1' }, { challenge_id: 'c1' }, { challenge_id: 'c1' }],
      liveTotalDaysByChallenge: { c1: 3 },
      historyEntries: [],
    })

    expect(result).toEqual({ totalDaysCompleted: 3, challengesFinished: 1 })
  })

  it('não conta como concluído um desafio ao vivo ainda em andamento (completed < total)', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [{ challenge_id: 'c1' }, { challenge_id: 'c1' }],
      liveTotalDaysByChallenge: { c1: 5 },
      historyEntries: [],
    })

    expect(result).toEqual({ totalDaysCompleted: 2, challengesFinished: 0 })
  })

  it('soma os dias e desafios concluídos do histórico (arquivados compartilhados)', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [],
      liveTotalDaysByChallenge: {},
      historyEntries: [
        { daysCompleted: 10, totalDays: 10 }, // concluído
        { daysCompleted: 4, totalDays: 9 }, // não concluído
      ],
    })

    expect(result).toEqual({ totalDaysCompleted: 14, challengesFinished: 1 })
  })

  it('combina desafios ao vivo e do histórico sem misturar as contagens', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [{ challenge_id: 'c1' }, { challenge_id: 'c1' }],
      liveTotalDaysByChallenge: { c1: 2 },
      historyEntries: [{ daysCompleted: 5, totalDays: 5 }],
    })

    expect(result).toEqual({ totalDaysCompleted: 7, challengesFinished: 2 })
  })

  it('múltiplos desafios ao vivo diferentes são contados separadamente (não soma tudo num "challenge" só)', () => {
    const result = computeGardenJourneyStats({
      liveCompletions: [
        { challenge_id: 'c1' },
        { challenge_id: 'c1' },
        { challenge_id: 'c2' },
        { challenge_id: 'c2' },
      ],
      liveTotalDaysByChallenge: { c1: 2, c2: 2 },
      historyEntries: [],
    })

    expect(result).toEqual({ totalDaysCompleted: 4, challengesFinished: 2 })
  })

  it('sem nenhum dado, devolve zero em tudo (sem inventar progresso)', () => {
    expect(computeGardenJourneyStats({ liveCompletions: [], liveTotalDaysByChallenge: {}, historyEntries: [] })).toEqual(
      { totalDaysCompleted: 0, challengesFinished: 0 },
    )
  })
})

describe('formatGardenJourneySummary', () => {
  it('estado inicial honesto quando não há nada acumulado (sem "0 dias")', () => {
    expect(formatGardenJourneySummary({ totalDaysCompleted: 0, challengesFinished: 0 })).toBe(
      'Sua jornada no Círcula está começando',
    )
  })

  it('singular/plural correto para 1 dia, sem desafios concluídos', () => {
    expect(formatGardenJourneySummary({ totalDaysCompleted: 1, challengesFinished: 0 })).toBe(
      'Jornada no Círcula: 1 dia concluído',
    )
  })

  it('plural correto para vários dias, sem desafios concluídos', () => {
    expect(formatGardenJourneySummary({ totalDaysCompleted: 5, challengesFinished: 0 })).toBe(
      'Jornada no Círcula: 5 dias concluídos',
    )
  })

  it('inclui desafios concluídos (singular) quando houver', () => {
    expect(formatGardenJourneySummary({ totalDaysCompleted: 10, challengesFinished: 1 })).toBe(
      'Jornada no Círcula: 10 dias concluídos · 1 desafio concluído',
    )
  })

  it('inclui desafios concluídos (plural) quando houver mais de um', () => {
    expect(formatGardenJourneySummary({ totalDaysCompleted: 20, challengesFinished: 2 })).toBe(
      'Jornada no Círcula: 20 dias concluídos · 2 desafios concluídos',
    )
  })
})
