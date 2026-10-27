import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useGardenMember } from './useGardenMember'

// `vi.hoisted` porque `vi.mock` abaixo é hoisted para o topo do arquivo
// pelo Vitest — sem isso, `fromMock` ainda seria `undefined` no momento
// em que a factory do mock roda. Mockar só `../lib/supabase` (não o
// hook inteiro, como em GardenMemberView.test.tsx) é o que permite
// testar a PRÓPRIA lógica de fetchHistory — incluindo que ela nunca
// pede dados de outra pessoa.
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

/** Builder encadeável mínimo (select/eq/in/order) que RESOLVE como a Promise que o código espera de volta do Supabase (sucesso OU {error} do PostgREST). */
function chainResult(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (resolve: (value: typeof result) => void, reject?: (reason: unknown) => void) => Promise<void>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  return builder
}

/** Mesmo builder, mas REJEITA — simula uma exceção de verdade (falha de rede, CORS, etc.), não um `{error}` já tratado pelo PostgREST. */
function chainReject(error: unknown) {
  const builder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (resolve: (value: never) => void, reject?: (reason: unknown) => void) => Promise<void>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    then: (resolve, reject) => Promise.reject(error).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  return builder
}

/**
 * Item 5 da auditoria — "proteção contra exposição de desafios sem
 * vínculo comprovado com a participante": a função pura
 * buildGardenHistory (ver types/garden.test.ts) já cobre a regra de
 * arquivado/deduplicação, mas ela confia cegamente nas linhas que
 * recebe. A garantia de que essas linhas são SÓ da própria pessoa
 * acontece aqui, na query (`.eq('profile_id', profileId)`) — por isso
 * estes testes mockam o Supabase de verdade, em vez do hook inteiro.
 *
 * Etapa E — ampliado para cobrir o tratamento de exceção de
 * `fetchHistory` (ver useGardenMember.ts): antes, uma rejeição de
 * verdade (não um `{error}` do PostgREST) deixava `historyLoading`
 * travado em `true` para sempre.
 */
describe('useGardenMember.fetchHistory', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe('proteção contra exposição de desafios de terceiros', () => {
    it('consulta garden_shares filtrando por profile_id = a própria participante', async () => {
      const sharesBuilder = chainResult({ data: [], error: null })
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(fromMock).toHaveBeenCalledWith('garden_shares')
      expect(sharesBuilder.eq).toHaveBeenCalledWith('profile_id', 'member-1')
      expect(result.current.history).toEqual([])
    })

    it('a checagem de "ainda publicado" cobre só os challenge_id dos MEUS compartilhamentos, nunca a tabela inteira', async () => {
      const shareRows = [
        {
          challenge_id: 'archived-1',
          challenge_title: 'Desafio arquivado',
          days_completed: 5,
          total_days: 8,
          color_one: 'sage',
          color_two: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]
      const sharesBuilder = chainResult({ data: shareRows, error: null })
      const challengesBuilder = chainResult({ data: [], error: null }) // nenhum "ainda publicado" -> é histórico

      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        if (table === 'garden_challenges') return challengesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(challengesBuilder.in).toHaveBeenCalledWith('id', ['archived-1'])
      expect(result.current.history).toEqual([
        {
          challengeId: 'archived-1',
          challengeTitle: 'Desafio arquivado',
          daysCompleted: 5,
          totalDays: 8,
          colorOne: 'sage',
          colorTwo: null,
          lastSharedAt: '2026-09-01T00:00:00.000Z',
        },
      ])
    })

    it('sem nenhum compartilhamento meu, nem chega a consultar garden_challenges', async () => {
      const sharesBuilder = chainResult({ data: [], error: null })
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(fromMock).toHaveBeenCalledTimes(1)
      expect(fromMock).not.toHaveBeenCalledWith('garden_challenges')
    })

    it('propaga o erro de garden_shares sem travar o loading', async () => {
      const sharesBuilder = chainResult({ data: null, error: { message: 'network down' } })
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyError).toBe('network down')
      expect(result.current.historyLoading).toBe(false)
      expect(result.current.history).toBeNull()
    })
  })

  describe('tratamento de erro e exceção (Etapa E)', () => {
    it('1. carregamento bem-sucedido: history preenchido, historyError nulo, historyLoading termina em false', async () => {
      const shareRows = [
        {
          challenge_id: 'archived-1',
          challenge_title: 'Desafio de outubro',
          days_completed: 3,
          total_days: 6,
          color_one: 'rose',
          color_two: null,
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ]
      const sharesBuilder = chainResult({ data: shareRows, error: null })
      const challengesBuilder = chainResult({ data: [], error: null })
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        if (table === 'garden_challenges') return challengesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      expect(result.current.historyLoading).toBe(false) // nunca buscou ainda

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyLoading).toBe(false)
      expect(result.current.historyError).toBeNull()
      expect(result.current.history).toHaveLength(1)
      expect(result.current.history?.[0].challengeTitle).toBe('Desafio de outubro')
    })

    it('2. erro retornado pelo Supabase ({error} do PostgREST): historyError preenchido, history continua null (não é "histórico vazio")', async () => {
      const sharesBuilder = chainResult({ data: null, error: { message: 'permission denied' } })
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyError).toBe('permission denied')
      expect(result.current.historyLoading).toBe(false)
      expect(result.current.history).toBeNull()
    })

    it('3. exceção lançada pela consulta (ex.: falha de rede/CORS), não um {error} do Supabase', async () => {
      const sharesBuilder = chainReject(new Error('Failed to fetch'))
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyError).toBe('Failed to fetch')
      // Falha não pode parecer sucesso nem "histórico vazio" — history
      // continua null (diferente de `[]`, que só o caminho de sucesso
      // sem compartilhamentos usa).
      expect(result.current.history).toBeNull()
    })

    it('3b. usa uma mensagem padrão quando o valor lançado não é um Error de verdade', async () => {
      const sharesBuilder = chainReject('algo quebrou, sem ser um Error')
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyError).toBe('Não foi possível carregar seu histórico agora.')
    })

    it('4. a promise de fetchHistory nunca rejeita mesmo com uma exceção real, e historyLoading termina em false (não trava em "Carregando...")', async () => {
      const sharesBuilder = chainReject(new Error('offline'))
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_shares') return sharesBuilder
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      // Se fetchHistory() deixasse a exceção escapar (o bug original),
      // este await rejeitaria e o teste falharia bem aqui, antes de
      // qualquer assert — a chamada não lançar já é parte da prova.
      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyLoading).toBe(false)
      expect(result.current.historyError).toBe('offline')
    })

    it('5. nova tentativa após falha: history continua null após a exceção, então uma 2ª chamada a fetchHistory pode ter sucesso (mesmo contrato que o toggle de "Meu histórico" usa ao reabrir)', async () => {
      const failingShares = chainReject(new Error('offline'))
      const successShares = chainResult({ data: [], error: null })

      let sharesCallCount = 0
      fromMock.mockImplementation((table: string) => {
        if (table !== 'garden_shares') throw new Error(`tabela inesperada nesta consulta: ${table}`)
        sharesCallCount += 1
        return sharesCallCount === 1 ? failingShares : successShares
      })

      const { result } = renderHook(() => useGardenMember(null, 'member-1'))

      // 1ª tentativa: falha.
      await act(async () => {
        await result.current.fetchHistory()
      })
      expect(result.current.historyError).toBe('offline')
      expect(result.current.history).toBeNull()

      // GardenHistorySection só rechama fetchHistory quando `history
      // === null` (ver GardenMemberView.tsx) — é exatamente o estado em
      // que a falha acima deixou o hook, então a 2ª chamada (a mesma
      // que o fechar/reabrir da seção dispararia) é uma tentativa real,
      // não um comportamento inventado neste teste.
      await act(async () => {
        await result.current.fetchHistory()
      })

      expect(result.current.historyError).toBeNull()
      expect(result.current.history).toEqual([])
      expect(sharesCallCount).toBe(2)
    })
  })
})

/**
 * Etapa AA — audita e corrige os Findings 1 e 2 da Etapa Z:
 * - Finding 1: `fetchAll` (carregamento principal da participante) não
 *   tinha `try/catch` nenhum — uma exceção de verdade (rejeição de rede)
 *   deixava `loading` travado em `true` para sempre, sem erro nenhum.
 * - Finding 2: `garden_enrollments`/`garden_completions` tinham seu
 *   `.error` ignorado (`data ?? []`) — uma falha de consulta era
 *   indistinguível de "realmente não há nenhuma".
 * Mesmo padrão de mock desta suíte (Supabase real mockado, não o hook).
 */
describe('useGardenMember.fetchAll (Etapa AA)', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  const ENROLLMENT_ROW = {
    id: 'enroll-1',
    challenge_id: 'challenge-1',
    profile_id: 'member-1',
    enrolled_at: '2026-10-19T00:00:00.000Z',
  }
  const COMPLETION_ROW = {
    id: 'completion-1',
    challenge_id: 'challenge-1',
    challenge_day_id: 'day-1',
    enrollment_id: 'enroll-1',
    profile_id: 'member-1',
    completed_at: '2026-10-19T00:00:00.000Z',
  }

  describe('Finding 1 — exceção inesperada', () => {
    it('1. exceção ao carregar os desafios: loading termina em false e error é preenchido (recuperável)', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainReject(new Error('Failed to fetch'))
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Failed to fetch')
    })

    it('usa uma mensagem padrão quando o valor lançado não é um Error de verdade', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainReject('algo quebrou, sem ser um Error')
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.error).toBe('Não foi possível carregar o Meu Jardim agora.')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Finding 2 — erros de inscrições/conclusões distintos de lista vazia', () => {
    it('2. erro ao carregar inscrições: enrollmentsError preenchido, não tratado como "não inscrita"', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') {
          return chainResult({ data: null, error: { message: 'permission denied' } })
        }
        if (table === 'garden_completions') return chainResult({ data: [], error: null })
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.enrollmentsError).toBe('permission denied')
      expect(result.current.loading).toBe(false)
    })

    it('3. erro ao carregar conclusões: completionsError preenchido, não tratado como "nenhum dia concluído"', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') return chainResult({ data: [], error: null })
        if (table === 'garden_completions') {
          return chainResult({ data: null, error: { message: 'timeout' } })
        }
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.completionsError).toBe('timeout')
      expect(result.current.loading).toBe(false)
    })

    it('5. falha em inscrições com conclusões válidas: os dados válidos de conclusões são preservados', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') {
          return chainResult({ data: null, error: { message: 'permission denied' } })
        }
        if (table === 'garden_completions') return chainResult({ data: [COMPLETION_ROW], error: null })
        if (table === 'garden_shares') return chainResult({ data: [], error: null })
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.enrollmentsError).toBe('permission denied')
      expect(result.current.completionsError).toBeNull()
      expect(result.current.myCompletions).toEqual([COMPLETION_ROW])
    })

    it('6. falha em conclusões com inscrições válidas: as inscrições válidas são preservadas', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') return chainResult({ data: [ENROLLMENT_ROW], error: null })
        if (table === 'garden_completions') {
          return chainResult({ data: null, error: { message: 'timeout' } })
        }
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.completionsError).toBe('timeout')
      expect(result.current.enrollmentsError).toBeNull()
      expect(result.current.myEnrollments).toEqual([ENROLLMENT_ROW])
    })

    it('7. falha simultânea nas duas consultas: as duas são registradas de forma independente', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') {
          return chainResult({ data: null, error: { message: 'erro de inscrições' } })
        }
        if (table === 'garden_completions') {
          return chainResult({ data: null, error: { message: 'erro de conclusões' } })
        }
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})

      expect(result.current.enrollmentsError).toBe('erro de inscrições')
      expect(result.current.completionsError).toBe('erro de conclusões')
    })

    it('8. nova tentativa bem-sucedida: enrollmentsError desaparece e myEnrollments é atualizado', async () => {
      let enrollmentsCall = 0
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') return chainResult({ data: [{ id: 'challenge-1' }], error: null })
        if (table === 'garden_enrollments') {
          enrollmentsCall += 1
          return enrollmentsCall === 1
            ? chainResult({ data: null, error: { message: 'permission denied' } })
            : chainResult({ data: [ENROLLMENT_ROW], error: null })
        }
        if (table === 'garden_completions') return chainResult({ data: [], error: null })
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))
      await act(async () => {})
      expect(result.current.enrollmentsError).toBe('permission denied')

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.enrollmentsError).toBeNull()
      expect(result.current.myEnrollments).toEqual([ENROLLMENT_ROW])
    })
  })

  describe('Concorrência', () => {
    it('9. solicitações sobrepostas: uma resposta antiga de fetchAll não sobrescreve o resultado de uma chamada mais nova', async () => {
      let resolveFirstChallenges: (value: { data: unknown; error: unknown }) => void = () => {}
      const pendingChallengesBuilder: {
        select: ReturnType<typeof vi.fn>
        eq: ReturnType<typeof vi.fn>
        order: ReturnType<typeof vi.fn>
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise<void>
      } = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        then: (resolve) =>
          new Promise<{ data: unknown; error: unknown }>((res) => {
            resolveFirstChallenges = res
          }).then(resolve),
      }
      pendingChallengesBuilder.select.mockReturnValue(pendingChallengesBuilder)
      pendingChallengesBuilder.eq.mockReturnValue(pendingChallengesBuilder)
      pendingChallengesBuilder.order.mockReturnValue(pendingChallengesBuilder)

      let challengesCall = 0
      fromMock.mockImplementation((table: string) => {
        if (table === 'garden_challenges') {
          challengesCall += 1
          return challengesCall === 1
            ? pendingChallengesBuilder
            : chainResult({ data: [{ id: 'challenge-2' }], error: null })
        }
        if (table === 'garden_enrollments') return chainResult({ data: [], error: null })
        if (table === 'garden_completions') return chainResult({ data: [], error: null })
        throw new Error(`tabela inesperada nesta consulta: ${table}`)
      })

      const { result } = renderHook(() => useGardenMember('community-1', 'member-1'))

      // A 1ª busca (do mount) fica pendurada; dispara a 2ª manualmente antes dela terminar.
      await act(async () => {
        await result.current.refresh()
      })
      expect(result.current.challenges).toEqual([{ id: 'challenge-2' }])

      // Resolve a 1ª (obsoleta) DEPOIS — não pode sobrescrever o resultado da 2ª.
      await act(async () => {
        resolveFirstChallenges({ data: [{ id: 'challenge-1-stale' }], error: null })
      })
      expect(result.current.challenges).toEqual([{ id: 'challenge-2' }])
    })
  })
})
