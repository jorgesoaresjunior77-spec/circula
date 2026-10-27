import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useGardenChallenges } from './useGardenChallenges'

// Mesmo padrão de useGardenMember.test.ts: mocka só `../lib/supabase` (não o
// hook inteiro, como em GardenChallengeManager.test.tsx) — é o que permite
// testar a PRÓPRIA lógica de `fetchChallenges`, incluindo o tratamento de
// exceção e a proteção contra respostas obsoletas (Etapa AA).
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

/** Builder encadeável mínimo (select/eq/order) que RESOLVE como a Promise que o código espera de volta do Supabase (sucesso OU {error} do PostgREST). */
function chainResult(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (resolve: (value: typeof result) => void, reject?: (reason: unknown) => void) => Promise<void>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  return builder
}

/** Mesmo builder, mas REJEITA — simula uma exceção de verdade (falha de rede, CORS, etc.), não um `{error}` já tratado pelo PostgREST. */
function chainReject(error: unknown) {
  const builder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (resolve: (value: never) => void, reject?: (reason: unknown) => void) => Promise<void>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve, reject) => Promise.reject(error).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  return builder
}

/**
 * Etapa AA — corrige o Finding 1 da auditoria da Etapa Z: `fetchChallenges`
 * (carregamento principal do painel profissional do Meu Jardim) não tinha
 * nenhum `try/catch`. Uma exceção de verdade (rejeição de rede) deixava
 * `loading` travado em `true` para sempre, sem nenhum erro — a tela ficava
 * presa em "Carregando desafios..." indefinidamente, sem jeito de perceber
 * a falha nem de tentar de novo. Este arquivo não existia antes desta
 * etapa (o hook só era exercitado indiretamente, com o hook inteiro
 * mockado, em GardenChallengeManager.test.tsx) — criado agora para poder
 * testar a implementação REAL de `fetchChallenges`, mesmo padrão de
 * useGardenMember.test.ts.
 */
describe('useGardenChallenges.fetchChallenges (Etapa AA — Finding 1)', () => {
  afterEach(() => {
    cleanup()
    fromMock.mockReset()
  })

  it('1. carregamento bem-sucedido: challenges preenchido, error nulo, loading termina em false', async () => {
    fromMock.mockReturnValue(chainResult({ data: [{ id: 'challenge-1' }], error: null }))

    const { result } = renderHook(() => useGardenChallenges('community-1'))
    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.challenges).toEqual([{ id: 'challenge-1' }])
  })

  it('erro retornado pelo Supabase ({error} do PostgREST): error preenchido, challenges vazio, loading termina em false', async () => {
    fromMock.mockReturnValue(chainResult({ data: null, error: { message: 'permission denied' } }))

    const { result } = renderHook(() => useGardenChallenges('community-1'))
    await act(async () => {})

    expect(result.current.error).toBe('permission denied')
    expect(result.current.loading).toBe(false)
    expect(result.current.challenges).toEqual([])
  })

  it('2. exceção lançada pela consulta (falha de rede/CORS), não um {error} do Supabase: loading termina e error é preenchido (recuperável)', async () => {
    fromMock.mockReturnValue(chainReject(new Error('Failed to fetch')))

    const { result } = renderHook(() => useGardenChallenges('community-1'))

    // Se fetchChallenges deixasse a exceção escapar (o bug original), este
    // await rejeitaria e o teste falharia aqui, antes de qualquer assert —
    // a chamada do mount não lançar já é parte da prova.
    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Failed to fetch')
    expect(result.current.challenges).toEqual([])
  })

  it('usa uma mensagem padrão quando o valor lançado não é um Error de verdade', async () => {
    fromMock.mockReturnValue(chainReject('algo quebrou, sem ser um Error'))

    const { result } = renderHook(() => useGardenChallenges('community-1'))
    await act(async () => {})

    expect(result.current.error).toBe('Não foi possível carregar os desafios agora.')
  })

  it('8. nova tentativa bem-sucedida após exceção: error desaparece e challenges são atualizados (refresh = fetchChallenges)', async () => {
    let call = 0
    fromMock.mockImplementation(() => {
      call += 1
      return call === 1 ? chainReject(new Error('offline')) : chainResult({ data: [{ id: 'challenge-1' }], error: null })
    })

    const { result } = renderHook(() => useGardenChallenges('community-1'))
    await act(async () => {})
    expect(result.current.error).toBe('offline')

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.challenges).toEqual([{ id: 'challenge-1' }])
  })

  it('9. solicitações sobrepostas: uma resposta antiga não sobrescreve o resultado de uma chamada mais nova', async () => {
    let resolveFirst: (value: { data: unknown; error: unknown }) => void = () => {}
    const pendingBuilder: {
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
          resolveFirst = res
        }).then(resolve),
    }
    pendingBuilder.select.mockReturnValue(pendingBuilder)
    pendingBuilder.eq.mockReturnValue(pendingBuilder)
    pendingBuilder.order.mockReturnValue(pendingBuilder)

    let call = 0
    fromMock.mockImplementation(() => {
      call += 1
      return call === 1 ? pendingBuilder : chainResult({ data: [{ id: 'challenge-2' }], error: null })
    })

    const { result } = renderHook(() => useGardenChallenges('community-1'))

    // A 1ª busca (do mount) fica pendurada; dispara a 2ª manualmente (ex.: clicar
    // em "Tentar novamente") antes dela terminar.
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.challenges).toEqual([{ id: 'challenge-2' }])

    // Resolve a 1ª (obsoleta) DEPOIS — não pode sobrescrever o resultado da 2ª.
    await act(async () => {
      resolveFirst({ data: [{ id: 'challenge-1-stale' }], error: null })
    })
    expect(result.current.challenges).toEqual([{ id: 'challenge-2' }])
  })
})
