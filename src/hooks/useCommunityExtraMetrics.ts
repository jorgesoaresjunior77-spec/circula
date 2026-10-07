import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PanelExtraMetrics } from '../types/panel'

// Fase 8 — métricas AMPLIADAS da comunidade, montadas no cliente a partir
// de fontes reais já existentes. NÃO altera a RPC `community_metrics`
// (que segue cobrindo membros / posts / comentários / reações /
// check-ins / círculos). Aqui só o que faltava: eventos, receitas,
// conteúdos e momentos de alegria. Nenhuma métrica sem fonte real.
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
  content_published: 0,
  joy_moments_period: 0,
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

    const [eventsUpcoming, eventsPeriod, contentPublished, joyPeriod] = await Promise.all([
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
    ])

    setMetrics({
      events_upcoming: eventsUpcoming,
      events_total_period: eventsPeriod,
      content_published: contentPublished,
      joy_moments_period: joyPeriod,
    })
    setLoading(false)
  }, [communityId, periodDays])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refresh: fetchMetrics }
}
