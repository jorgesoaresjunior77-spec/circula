import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PanelExtraMetrics } from '../types/panel'

// Fase 8 — métricas AMPLIADAS da comunidade, montadas no cliente a partir
// de fontes reais já existentes. NÃO altera a RPC `community_metrics`
// (que segue cobrindo membros / posts / comentários / reações / desafios
// / check-ins / círculos). Aqui só o que faltava: eventos, receitas,
// conteúdos, conclusões de desafio, momentos de alegria, pedidos de ajuda
// e pontos (via a RPC da Fase 7). Nenhuma métrica sem fonte real.
//
// A RLS já entrega tudo isso para `owns_community()` / `is_master()`;
// os counts usam GET + `count: 'exact'` + `.limit(0)` (não `head: true`):
// o gateway do Supabase responde 503 às requisições `HEAD` que o
// supabase-js emite para `head: true`; o mesmo GET devolve 200 com o
// total no `Content-Range` (`res.count`) e corpo vazio.

function windowStartISO(periodDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.max(periodDays - 1, 0))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const EMPTY: PanelExtraMetrics = {
  events_upcoming: 0,
  events_total_period: 0,
  recipes_published: 0,
  content_published: 0,
  challenge_completions_period: 0,
  joy_moments_period: 0,
  help_open: 0,
  help_in_progress: 0,
  help_resolved: 0,
  points_period: 0,
  points_all_time: 0,
}

export function useCommunityExtraMetrics(communityId: string | null, periodDays: number) {
  const [metrics, setMetrics] = useState<PanelExtraMetrics>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!communityId) {
      setMetrics(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const since = windowStartISO(periodDays)
    const nowIso = new Date().toISOString()

    const exactCount = async (builder: PromiseLike<unknown>): Promise<number> => {
      const res = (await builder) as { count: number | null }
      return res.count ?? 0
    }

    const challengeIdsRes = await supabase
      .from('community_challenges')
      .select('id')
      .eq('community_id', communityId)
    const challengeIds = (challengeIdsRes.data as { id: string }[] | null)?.map((r) => r.id) ?? []

    const [
      eventsUpcoming,
      eventsPeriod,
      recipesPublished,
      contentPublished,
      joyPeriod,
      helpRows,
      pointsSummary,
      completionsPeriod,
    ] = await Promise.all([
      exactCount(
        supabase
          .from('community_events')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .neq('status', 'draft')
          .gte('starts_at', nowIso)
          .limit(0),
      ),
      exactCount(
        supabase
          .from('community_events')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .gte('created_at', since)
          .limit(0),
      ),
      exactCount(
        supabase
          .from('community_content')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .eq('type', 'recipe')
          .eq('status', 'published')
          .limit(0),
      ),
      exactCount(
        supabase
          .from('community_content')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .neq('type', 'recipe')
          .eq('status', 'published')
          .limit(0),
      ),
      exactCount(
        supabase
          .from('joy_moments')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .gte('created_at', since)
          .limit(0),
      ),
      supabase.from('help_requests').select('status').eq('community_id', communityId),
      supabase.rpc('points_community_summary', {
        p_community_id: communityId,
        p_period_days: periodDays,
      }),
      challengeIds.length > 0
        ? exactCount(
            supabase
              .from('challenge_completions')
              .select('id', { count: 'exact' })
              .in('challenge_id', challengeIds)
              .gte('completed_at', since)
              .limit(0),
          )
        : Promise.resolve(0),
    ])

    if (pointsSummary.error) {
      setError(pointsSummary.error.message)
      setLoading(false)
      return
    }

    const help = { open: 0, in_progress: 0, resolved: 0 }
    for (const row of (helpRows.data as { status: keyof typeof help }[] | null) ?? []) {
      if (row.status in help) help[row.status] += 1
    }

    const summary = pointsSummary.data as {
      total_points_period?: number
      total_points_all_time?: number
    } | null

    setMetrics({
      events_upcoming: eventsUpcoming,
      events_total_period: eventsPeriod,
      recipes_published: recipesPublished,
      content_published: contentPublished,
      challenge_completions_period: completionsPeriod,
      joy_moments_period: joyPeriod,
      help_open: help.open,
      help_in_progress: help.in_progress,
      help_resolved: help.resolved,
      points_period: summary?.total_points_period ?? 0,
      points_all_time: summary?.total_points_all_time ?? 0,
    })
    setLoading(false)
  }, [communityId, periodDays])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refresh: fetchMetrics }
}
