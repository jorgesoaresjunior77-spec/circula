import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentPeriodMonth } from '../types/gardenEvolution'
import type {
  GardenMonthlyCompletionRow,
  GardenMonthlyPointsRow,
} from '../types/gardenEvolution'

// Etapa 6 (evolução/experiência/gamificação) — leitura do progresso
// mensal/anual do Meu Jardim. SÓ LEITURA: toda escrita acontece nos
// gatilhos do servidor (ver migration 20261030140000, preparada e NÃO
// aplicada ainda) — este hook nunca concede pontos, só exibe o que já
// foi concedido.
//
// Até a migration ser aplicada no banco remoto, as duas tabelas não
// existem — a consulta volta um erro do PostgREST (relação
// inexistente), tratado aqui como qualquer outro erro de carregamento
// (mesmo padrão de erro/retry já usado no resto do app, sem mensagem
// especial): a tela mostra "não foi possível carregar" em vez de
// quebrar ou carregar para sempre.
//
// useGardenEvolution(null, null) não faz fetch.

export function useGardenEvolution(communityId: string | null, profileId: string | null) {
  const [monthlyPoints, setMonthlyPoints] = useState<GardenMonthlyPointsRow[]>([])
  const [completions, setCompletions] = useState<GardenMonthlyCompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!communityId || !profileId) {
      setMonthlyPoints([])
      setCompletions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [pointsResult, completionsResult] = await Promise.all([
      supabase
        .from('garden_monthly_points')
        .select('id,profile_id,community_id,period_month,source,source_id,points,created_at')
        .eq('profile_id', profileId)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false }),
      supabase
        .from('garden_monthly_completions')
        .select('id,profile_id,community_id,period_month,total_points,completed_at')
        .eq('profile_id', profileId)
        .eq('community_id', communityId)
        .order('period_month', { ascending: false }),
    ])

    if (pointsResult.error || completionsResult.error) {
      setError(
        pointsResult.error?.message ??
          completionsResult.error?.message ??
          'Não foi possível carregar o Meu Jardim agora.',
      )
      setLoading(false)
      return
    }

    setMonthlyPoints((pointsResult.data as unknown as GardenMonthlyPointsRow[] | null) ?? [])
    setCompletions(
      (completionsResult.data as unknown as GardenMonthlyCompletionRow[] | null) ?? [],
    )
    setLoading(false)
  }, [communityId, profileId])

  useEffect(() => {
    // Adia a busca para fora do corpo síncrono do efeito: o fetchAll começa
    // com setState (loading/limpeza) e isso dentro do efeito força um render extra.
    let active = true
    void Promise.resolve().then(() => {
      if (active) void fetchAll()
    })
    return () => {
      active = false
    }
  }, [fetchAll])

  const period = currentPeriodMonth()
  const currentMonthPoints = monthlyPoints
    .filter((row) => row.period_month === period)
    .reduce((sum, row) => sum + row.points, 0)
  const currentMonthActivities = monthlyPoints.filter((row) => row.period_month === period)

  return {
    monthlyPoints,
    completions,
    currentMonthPoints,
    currentMonthActivities,
    loading,
    error,
    refresh: fetchAll,
  }
}
