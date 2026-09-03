import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  CHALLENGE_MILESTONES,
  DAY_MILESTONES,
  POINT_MILESTONES,
  TIME_MILESTONES,
  type Achievement,
} from '../types/achievement'

// Fase 10 — conquistas DERIVADAS. Lê só linhas da própria usuária (a RLS
// já restringe a `profile_id = auth.uid()` em todas as tabelas usadas).
// Sem migration, sem RPC, sem escrita. useAchievements(null) não busca.

interface Metrics {
  pointsBalance: number
  challengesCompleted: number
  challengeDaysDone: number
  joyMomentsShared: number
  /** meses inteiros desde a entrada na comunidade */
  monthsInCommunity: number
}

const EMPTY: Metrics = {
  pointsBalance: 0,
  challengesCompleted: 0,
  challengeDaysDone: 0,
  joyMomentsShared: 0,
  monthsInCommunity: 0,
}

function monthsBetween(fromIso: string): number {
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return 0
  const now = new Date()
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth())
  if (now.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

function timeLabel(months: number): string {
  if (months >= 12) return months === 12 ? '1 ano' : `${Math.floor(months / 12)} anos`
  return months === 1 ? '1 mês' : `${months} meses`
}

function buildAchievements(m: Metrics): Achievement[] {
  const list: Achievement[] = []

  for (const target of POINT_MILESTONES) {
    list.push({
      id: `points-${target}`,
      group: 'points',
      icon: '⭐',
      title: `${target} pontos`,
      description: `Você acumulou ${target} pontos nesta comunidade.`,
      unlocked: m.pointsBalance >= target,
      current: m.pointsBalance,
      target,
    })
  }

  for (const target of CHALLENGE_MILESTONES) {
    list.push({
      id: `challenges-${target}`,
      group: 'challenges',
      icon: '🌿',
      title: target === 1 ? 'Primeiro desafio concluído' : `${target} desafios concluídos`,
      description:
        target === 1
          ? 'Você concluiu o seu primeiro desafio. Que comece a jornada!'
          : `Você já concluiu ${target} desafios completos.`,
      unlocked: m.challengesCompleted >= target,
      current: m.challengesCompleted,
      target,
    })
  }

  for (const target of DAY_MILESTONES) {
    list.push({
      id: `days-${target}`,
      group: 'days',
      icon: '📅',
      title: `${target} dias de desafio`,
      description: `Você marcou ${target} dias de desafio. Consistência é tudo.`,
      unlocked: m.challengeDaysDone >= target,
      current: m.challengeDaysDone,
      target,
    })
  }

  for (const target of TIME_MILESTONES) {
    list.push({
      id: `time-${target}`,
      group: 'time',
      icon: '🏡',
      title: `${timeLabel(target)} no Círcula`,
      description: `Você faz parte desta comunidade há ${timeLabel(target)}.`,
      unlocked: m.monthsInCommunity >= target,
      current: m.monthsInCommunity,
      target,
    })
  }

  list.push({
    id: 'joy-1',
    group: 'joy',
    icon: '🌸',
    title: 'Primeiro momento de alegria',
    description: 'Você compartilhou um momento de alegria com a comunidade.',
    unlocked: m.joyMomentsShared >= 1,
    current: m.joyMomentsShared,
    target: 1,
  })

  return list
}

export function useAchievements(communityId: string | null, profileId: string | null) {
  const [metrics, setMetrics] = useState<Metrics>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!communityId || !profileId) {
      setMetrics(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Contagem exata SEM trafegar linhas. Usa GET + `count: 'exact'` +
    // `.limit(0)` (não `head: true`): o gateway do Supabase
    // (`sb-gateway-version: 1`) responde 503 às requisições `HEAD` que o
    // supabase-js emite para `head: true`, enquanto o mesmo GET devolve
    // 200 com o total no cabeçalho `Content-Range` (lido em `res.count`).
    // `limit(0)` => corpo vazio, mesmo custo de rede de um HEAD.
    const exactCount = async (builder: PromiseLike<unknown>): Promise<number> => {
      const res = (await builder) as { count: number | null }
      return res.count ?? 0
    }

    const challengeIdsRes = await supabase
      .from('community_challenges')
      .select('id')
      .eq('community_id', communityId)
    const challengeIds = (challengeIdsRes.data as { id: string }[] | null)?.map((r) => r.id) ?? []

    const [accountRes, completions, daysDone, joyCount, memberRes] = await Promise.all([
      supabase
        .from('point_accounts')
        .select('balance')
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .maybeSingle(),
      challengeIds.length
        ? exactCount(
            supabase
              .from('challenge_completions')
              .select('id', { count: 'exact' })
              .eq('profile_id', profileId)
              .in('challenge_id', challengeIds)
              .limit(0),
          )
        : Promise.resolve(0),
      challengeIds.length
        ? exactCount(
            supabase
              .from('challenge_progress')
              .select('id', { count: 'exact' })
              .eq('profile_id', profileId)
              .in('challenge_id', challengeIds)
              .limit(0),
          )
        : Promise.resolve(0),
      exactCount(
        supabase
          .from('joy_moments')
          .select('id', { count: 'exact' })
          .eq('community_id', communityId)
          .eq('profile_id', profileId)
          .limit(0),
      ),
      supabase
        .from('community_members')
        .select('joined_at')
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .maybeSingle(),
    ])

    if (challengeIdsRes.error) {
      setError(challengeIdsRes.error.message)
      setLoading(false)
      return
    }

    const joinedAt = (memberRes.data as { joined_at: string } | null)?.joined_at ?? null

    setMetrics({
      pointsBalance:
        typeof accountRes.data?.balance === 'number' ? accountRes.data.balance : 0,
      challengesCompleted: completions,
      challengeDaysDone: daysDone,
      joyMomentsShared: joyCount,
      monthsInCommunity: joinedAt ? monthsBetween(joinedAt) : 0,
    })
    setLoading(false)
  }, [communityId, profileId])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const achievements = useMemo(() => buildAchievements(metrics), [metrics])
  const unlocked = useMemo(() => achievements.filter((a) => a.unlocked), [achievements])
  const nextAchievement = useMemo(() => {
    const locked = achievements.filter((a) => !a.unlocked && a.target > 0)
    if (locked.length === 0) return null
    // a mais perto de completar (maior proporção current/target)
    return locked.reduce((best, a) =>
      a.current / a.target > best.current / best.target ? a : best,
    )
  }, [achievements])

  return {
    achievements,
    unlocked,
    unlockedCount: unlocked.length,
    nextAchievement,
    pointsBalance: metrics.pointsBalance,
    loading,
    error,
    refresh: fetchMetrics,
  }
}
