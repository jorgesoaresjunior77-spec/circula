import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfessionalDashboardData } from '../types/panel'

// Fase 8 — dados da Home do painel Professional. Tudo com fonte real,
// tudo já acessível à dona via RLS / RPCs existentes. Nenhuma tabela
// nova, nenhuma métrica inventada.
//
//   community_metrics (RPC)          -> membros / posts / comentários / reações
//   points_community_summary (RPC)   -> pontos do período + total + top 3
//   help_requests                    -> pendentes (open + in_progress)
//   community_challenges             -> ativos hoje (is_active & dentro do período)
//   community_content (recipe)       -> 3 receitas recentes publicadas
//   community_events                 -> 3 próximos eventos
//   posts                            -> 3 publicações recentes (RLS já filtra ocultas)

function todayISODate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const EMPTY: ProfessionalDashboardData = {
  members_total: 0,
  members_active: 0,
  members_inactive: 0,
  members_new: 0,
  help_pending: 0,
  challenges_active: 0,
  points_period: 0,
  points_all_time: 0,
  posts_count: 0,
  comments_count: 0,
  reactions_count: 0,
  recent_recipes: [],
  upcoming_events: [],
  recent_posts: [],
  top_earners: [],
}

export function useProfessionalDashboard(communityId: string | null, periodDays = 30) {
  const [data, setData] = useState<ProfessionalDashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    if (!communityId) {
      setData(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const today = todayISODate()
    const nowIso = new Date().toISOString()

    const [metricsRes, pointsRes, helpRes, challengesRes, recipesRes, eventsRes, postsRes] =
      await Promise.all([
        supabase.rpc('community_metrics', { p_community_id: communityId, p_period_days: periodDays }),
        supabase.rpc('points_community_summary', {
          p_community_id: communityId,
          p_period_days: periodDays,
        }),
        // GET + count + limit(0) em vez de head: true — o gateway do
        // Supabase responde 503 às requisições HEAD do supabase-js; o GET
        // devolve 200 com o total em Content-Range (helpRes.count).
        supabase
          .from('help_requests')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .in('status', ['open', 'in_progress'])
          .limit(0),
        supabase
          .from('community_challenges')
          .select('id,is_active,ends_on')
          .eq('community_id', communityId)
          .eq('is_active', true),
        supabase
          .from('community_content')
          .select('id,title,created_at')
          .eq('community_id', communityId)
          .eq('type', 'recipe')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('community_events')
          .select('id,title,starts_at')
          .eq('community_id', communityId)
          .neq('status', 'draft')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(3),
        supabase
          .from('posts')
          .select('id,content,created_at,author:profiles(full_name)')
          .eq('community_id', communityId)
          .is('circle_id', null)
          .order('created_at', { ascending: false })
          .limit(3),
      ])

    if (metricsRes.error) {
      setError(metricsRes.error.message)
      setLoading(false)
      return
    }

    const metrics = metricsRes.data as Record<string, number> | null
    const points = pointsRes.data as {
      total_points_period?: number
      total_points_all_time?: number
      top_earners?: { profile_id: string; full_name: string | null; balance: number }[] | null
    } | null

    const challengesActive = ((challengesRes.data as { ends_on: string | null }[] | null) ?? []).filter(
      (c) => !c.ends_on || c.ends_on >= today,
    ).length

    setData({
      members_total: metrics?.total_members ?? 0,
      members_active: metrics?.active_members ?? 0,
      members_inactive: metrics?.inactive_members ?? 0,
      members_new: metrics?.new_members ?? 0,
      help_pending: helpRes.count ?? 0,
      challenges_active: challengesActive,
      points_period: points?.total_points_period ?? 0,
      points_all_time: points?.total_points_all_time ?? 0,
      posts_count: metrics?.posts_count ?? 0,
      comments_count: metrics?.comments_count ?? 0,
      reactions_count: metrics?.reactions_count ?? 0,
      recent_recipes:
        (recipesRes.data as { id: string; title: string | null; created_at: string }[] | null) ?? [],
      upcoming_events:
        (eventsRes.data as { id: string; title: string; starts_at: string }[] | null) ?? [],
      recent_posts: (
        (postsRes.data as
          | { id: string; content: string; created_at: string; author: { full_name: string | null } | null }[]
          | null) ?? []
      ).map((p) => ({
        id: p.id,
        content: p.content,
        created_at: p.created_at,
        author_name: p.author?.full_name ?? null,
      })),
      top_earners: (points?.top_earners ?? []).slice(0, 3).map((e) => ({
        profile_id: e.profile_id,
        full_name: e.full_name,
        balance: e.balance,
      })),
    })
    setLoading(false)
  }, [communityId, periodDays])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return { data, loading, error, refresh: fetchDashboard }
}
