import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/profile'
import type { CircleWithMembers } from '../types/circle'
import type { Post } from '../types/post'
import type { HomeActivityItem, HomeSummary, HomeTodayData } from '../types/home'

// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
//
// Compõe o dashboard pessoal a partir de dados que já existem, sem RPC
// agregadora e sem migration.
//
// A5-cleanup (opção A): a lista do feed da comunidade agora vem de
// `feedPosts` (instância única de usePosts criada na HomeToday). Deste
// hook saíram DUAS consultas:
//   - (removida #1) ids das publicações da própria usuária → derivados
//     de `feedPosts.filter(author_id === viewer)`;
//   - (removida #2) publicações novas 24h → derivadas de `feedPosts`.
// Consequência consciente: o resumo passa a considerar só o feed da
// comunidade (`circle_id is null`); interações em publicações minhas
// DENTRO de círculos não entram mais neste resumo.
//
// Consultas que continuam aqui (nenhum hook cobre):
//   3. comentários de terceiros nas minhas publicações (janela 7 dias);
//   4. reações de terceiros nas minhas publicações (janela 7 dias);
//   5. (só anfitriã) novas participantes em 30 dias via community_metrics.
//
// "Entrada em círculo" na Atividade recente é derivada de `myCircles`
// (members aninhados que useCircles já traz) — nenhuma query extra.

const PERSON_SELECT = 'id,full_name,avatar_url'
const COMMENT_SELECT = `id,post_id,content,created_at,author:profiles(${PERSON_SELECT})`
const REACTION_SELECT = `id,post_id,created_at,profile:profiles(${PERSON_SELECT})`

const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000
const WINDOW_24H_MS = 24 * 60 * 60 * 1000
const ACTIVITY_LIMIT = 8
const EXCERPT_LEN = 80

interface RawPersonRef {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface RawComment {
  id: string
  post_id: string
  content: string
  created_at: string
  author: RawPersonRef | null
}

interface RawReaction {
  id: string
  post_id: string
  created_at: string
  profile: RawPersonRef | null
}

/** Só os campos que este hook usa da lista de posts do feed. */
type FeedPost = Pick<Post, 'id' | 'author_id' | 'created_at'>

const EMPTY_SUMMARY: HomeSummary = {
  repliesToMe: 0,
  reactionsToMe: 0,
  newPosts: 0,
  newMembers: null,
}

export function useHomeToday(
  profile: Profile | null,
  communityId: string | null,
  myCircles: CircleWithMembers[],
  /**
   * Lista do feed da comunidade (circle_id nulo), vinda da instância
   * ÚNICA de usePosts na HomeToday. Substitui as consultas #1 e #2.
   */
  feedPosts?: FeedPost[],
): HomeTodayData {
  const [comments, setComments] = useState<RawComment[]>([])
  const [reactions, setReactions] = useState<RawReaction[]>([])
  const [newMembers, setNewMembers] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const viewerId = profile?.id ?? null
  const role = profile?.role ?? null

  // Derivados de `feedPosts` — sem consulta ao banco.
  //
  // `myPostIdsKey`: ids (ordenados) das MINHAS publicações no feed da
  // comunidade, como string estável. As consultas #3/#4 só re-disparam
  // quando ESTE conjunto muda — uma nova identidade do array de posts
  // (ex.: após uma reação) com os mesmos ids não refaz nada.
  const myPostIdsKey = useMemo(() => {
    if (!viewerId || !feedPosts) return ''
    return feedPosts
      .filter((p) => p.author_id === viewerId)
      .map((p) => p.id)
      .sort()
      .join(',')
  }, [feedPosts, viewerId])

  // `recentNewPostDates`: created_at das publicações do feed nas últimas
  // 24h, desc. `length` = contagem; `[0]` = a mais recente (para o
  // timestamp do item "novas publicações" na Atividade recente).
  const recentNewPostDates = useMemo(() => {
    const cutoff = Date.now() - WINDOW_24H_MS
    return (feedPosts ?? [])
      .map((p) => p.created_at)
      .filter((iso) => {
        const t = new Date(iso).getTime()
        return !Number.isNaN(t) && t >= cutoff
      })
      .sort((a, b) => b.localeCompare(a))
  }, [feedPosts])

  const fetchData = useCallback(async () => {
    if (!viewerId || !communityId) {
      setComments([])
      setReactions([])
      setNewMembers(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // #1 removida: os ids das minhas publicações vêm de `feedPosts`.
    const myPostIds = myPostIdsKey ? myPostIdsKey.split(',') : []

    // #2 removida: publicações novas 24h derivam de `feedPosts`
    // (recentNewPostDates), fora daqui.
    const [commentsRes, reactionsRes, metricsRes] = await Promise.all([
      myPostIds.length
        ? supabase
            .from('post_comments')
            .select(COMMENT_SELECT)
            .in('post_id', myPostIds)
            .neq('author_id', viewerId)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      myPostIds.length
        ? supabase
            .from('post_reactions')
            .select(REACTION_SELECT)
            .in('post_id', myPostIds)
            .neq('profile_id', viewerId)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      role === 'professional'
        ? supabase.rpc('community_metrics', {
            p_community_id: communityId,
            p_period_days: 30,
          })
        : Promise.resolve({ data: null, error: null }),
    ])

    // Tolerância por fonte: uma consulta que falhe apenas zera o próprio
    // bloco, não derruba a tela inteira.
    setComments(
      commentsRes.error ? [] : ((commentsRes.data as unknown as RawComment[]) ?? []),
    )
    setReactions(
      reactionsRes.error ? [] : ((reactionsRes.data as unknown as RawReaction[]) ?? []),
    )

    const metricsData =
      !metricsRes.error && metricsRes.data
        ? (metricsRes.data as { new_members?: number })
        : null
    setNewMembers(
      metricsData && typeof metricsData.new_members === 'number'
        ? metricsData.new_members
        : null,
    )

    setLoading(false)
  }, [viewerId, role, communityId, myPostIdsKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = useMemo<HomeSummary>(() => {
    if (!viewerId || !communityId) return EMPTY_SUMMARY

    const cutoff = Date.now() - WINDOW_7D_MS
    const within7d = (iso: string) => {
      const t = new Date(iso).getTime()
      return !Number.isNaN(t) && t >= cutoff
    }

    return {
      repliesToMe: comments.filter((c) => within7d(c.created_at)).length,
      reactionsToMe: reactions.filter((r) => within7d(r.created_at)).length,
      newPosts: recentNewPostDates.length,
      newMembers,
    }
  }, [viewerId, communityId, comments, reactions, recentNewPostDates, newMembers])

  const recentActivity = useMemo<HomeActivityItem[]>(() => {
    if (!viewerId || !communityId) return []

    const cutoff = Date.now() - WINDOW_7D_MS
    const within7d = (iso: string) => {
      const t = new Date(iso).getTime()
      return !Number.isNaN(t) && t >= cutoff
    }

    const items: HomeActivityItem[] = []

    for (const c of comments) {
      if (!within7d(c.created_at)) continue
      items.push({
        id: `comment-${c.id}`,
        kind: 'comment',
        at: c.created_at,
        actorName: c.author?.full_name ?? null,
        actorAvatarUrl: c.author?.avatar_url ?? null,
        excerpt: c.content.trim().slice(0, EXCERPT_LEN),
      })
    }

    const recentReactions = reactions.filter((r) => within7d(r.created_at))
    if (recentReactions.length === 1) {
      const r = recentReactions[0]
      items.push({
        id: `reaction-${r.id}`,
        kind: 'reaction',
        at: r.created_at,
        actorName: r.profile?.full_name ?? null,
        actorAvatarUrl: r.profile?.avatar_url ?? null,
      })
    } else if (recentReactions.length > 1) {
      items.push({
        id: 'reaction-group',
        kind: 'reaction_group',
        at: recentReactions[0].created_at,
        actorName: null,
        actorAvatarUrl: null,
        count: recentReactions.length,
      })
    }

    if (recentNewPostDates.length > 0) {
      items.push({
        id: 'new-posts',
        kind: 'new_posts',
        at: recentNewPostDates[0],
        actorName: null,
        actorAvatarUrl: null,
        count: recentNewPostDates.length,
      })
    }

    for (const circle of myCircles) {
      for (const member of circle.members) {
        if (member.profile_id === viewerId) continue
        if (!within7d(member.joined_at)) continue
        items.push({
          id: `circle-join-${member.id}`,
          kind: 'circle_join',
          at: member.joined_at,
          actorName: member.profile?.full_name ?? null,
          actorAvatarUrl: member.profile?.avatar_url ?? null,
          circleName: circle.name,
        })
      }
    }

    return items
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, ACTIVITY_LIMIT)
  }, [viewerId, communityId, comments, reactions, recentNewPostDates, myCircles])

  return { summary, recentActivity, loading, error }
}
