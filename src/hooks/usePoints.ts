import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  AwardManualResult,
  PointAccount,
  PointLedgerEntry,
  PointLedgerEntryWithProfile,
  PointMemberBalance,
  PointsCommunitySummary,
  RecurringConfigResult,
} from '../types/points'

const ACCOUNT_SELECT = 'id,community_id,profile_id,balance,updated_at'
const LEDGER_SELECT =
  'id,community_id,profile_id,amount,reason,source_type,source_id,note,awarded_by,created_at'
// point_ledger tem 2 FKs para profiles (profile_id e awarded_by); o embed
// precisa nomear a FK, senao o PostgREST responde 300 (ambiguo).
const LEDGER_WITH_PROFILE_SELECT =
  `${LEDGER_SELECT},profile:profiles!point_ledger_profile_id_fkey(id,full_name,avatar_url)`

const LEDGER_PAGE = 50

function mapAwardError(message: string): string {
  if (message.includes('cannot_grant_to_self')) return 'Você não pode conceder pontos para si mesma.'
  if (message.includes('not_authorized')) return 'Você não administra esta comunidade.'
  if (message.includes('target_not_member')) return 'Essa pessoa não é membro ativo da comunidade.'
  if (message.includes('amount_out_of_range')) return 'A quantidade precisa estar entre 1 e 1000.'
  return 'Não foi possível conceder os pontos agora. Tente novamente.'
}

/**
 * Visão da própria usuária: saldo e histórico DELA nesta comunidade.
 * Sem `communityId`/`profileId` não busca (Master, ou Home sem comunidade
 * em foco). A RLS de point_accounts/point_ledger já restringe a
 * `profile_id = auth.uid()`; o filtro explícito deixa a intenção clara e
 * garante que nenhum saldo de outra comunidade se misture.
 */
export function usePoints(communityId: string | null, profileId: string | null) {
  const [account, setAccount] = useState<PointAccount | null>(null)
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!communityId || !profileId) {
      setAccount(null)
      setLedger([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [accountRes, ledgerRes] = await Promise.all([
      supabase
        .from('point_accounts')
        .select(ACCOUNT_SELECT)
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .maybeSingle(),
      supabase
        .from('point_ledger')
        .select(LEDGER_SELECT)
        .eq('community_id', communityId)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(LEDGER_PAGE),
    ])

    if (ledgerRes.error) {
      setError(ledgerRes.error.message)
      setAccount(null)
      setLedger([])
      setLoading(false)
      return
    }

    setAccount((accountRes.data as PointAccount | null) ?? null)
    setLedger((ledgerRes.data as unknown as PointLedgerEntry[]) ?? [])
    setLoading(false)
  }, [communityId, profileId])

  useEffect(() => {
    fetchPoints()
  }, [fetchPoints])

  return {
    account,
    balance: account?.balance ?? 0,
    ledger,
    loading,
    error,
    refresh: fetchPoints,
  }
}

interface AdminMemberRow {
  profile_id: string
  status: string
  profile: { id: string; full_name: string | null; avatar_url: string | null } | null
}

/**
 * Visão da Nutri: resumo agregado, saldo por participante, extrato da
 * comunidade e concessão manual. Escopo 100% na própria comunidade — a
 * RLS de point_ledger/point_accounts entrega tudo da comunidade para a
 * dona (`owns_community`) e nada de outra comunidade.
 */
export function usePointsAdmin(communityId: string | null, periodDays = 30) {
  const [summary, setSummary] = useState<PointsCommunitySummary | null>(null)
  const [memberBalances, setMemberBalances] = useState<PointMemberBalance[]>([])
  const [ledger, setLedger] = useState<PointLedgerEntryWithProfile[]>([])
  const [recurringPerDay, setRecurringPerDay] = useState(0)
  const [communityName, setCommunityName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!communityId) {
      setSummary(null)
      setMemberBalances([])
      setLedger([])
      setRecurringPerDay(0)
      setCommunityName('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [summaryRes, membersRes, accountsRes, ledgerRes, communityRes] = await Promise.all([
      supabase.rpc('points_community_summary', {
        p_community_id: communityId,
        p_period_days: periodDays,
      }),
      supabase
        .from('community_members')
        .select('profile_id,status,profile:profiles(id,full_name,avatar_url)')
        .eq('community_id', communityId)
        .eq('status', 'active'),
      supabase
        .from('point_accounts')
        .select('profile_id,balance,updated_at')
        .eq('community_id', communityId),
      supabase
        .from('point_ledger')
        .select(LEDGER_WITH_PROFILE_SELECT)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(LEDGER_PAGE),
      supabase
        .from('communities')
        .select('name,recurring_points_per_day')
        .eq('id', communityId)
        .maybeSingle(),
    ])

    if (summaryRes.error) {
      setError(summaryRes.error.message)
      setLoading(false)
      return
    }

    setSummary(summaryRes.data as PointsCommunitySummary)
    setCommunityName(
      typeof communityRes.data?.name === 'string' ? communityRes.data.name : '',
    )
    setRecurringPerDay(
      typeof communityRes.data?.recurring_points_per_day === 'number'
        ? communityRes.data.recurring_points_per_day
        : 0,
    )

    const balanceByProfile = new Map<string, { balance: number; updated_at: string }>()
    for (const row of (accountsRes.data as { profile_id: string; balance: number; updated_at: string }[]) ?? []) {
      balanceByProfile.set(row.profile_id, { balance: row.balance, updated_at: row.updated_at })
    }

    const members = ((membersRes.data as unknown as AdminMemberRow[]) ?? [])
      .filter((row) => row.profile)
      .map((row) => {
        const acc = balanceByProfile.get(row.profile_id)
        return {
          profile: {
            id: row.profile!.id,
            full_name: row.profile!.full_name,
            avatar_url: row.profile!.avatar_url,
          },
          balance: acc?.balance ?? 0,
          updated_at: acc?.updated_at ?? '',
        }
      })
      .sort((a, b) => b.balance - a.balance || (a.profile.full_name ?? '').localeCompare(b.profile.full_name ?? ''))

    setMemberBalances(members)
    setLedger((ledgerRes.data as unknown as PointLedgerEntryWithProfile[]) ?? [])
    setLoading(false)
  }, [communityId, periodDays])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function awardManual(
    profileId: string,
    amount: number,
    note: string,
  ): Promise<AwardManualResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: rpcError } = await supabase.rpc('award_points_manual', {
      p_community_id: communityId,
      p_profile_id: profileId,
      p_amount: amount,
      p_note: note.trim() || null,
    })

    if (rpcError) return { error: mapAwardError(rpcError.message) }

    await fetchAll()
    return { error: null }
  }

  async function setRecurringConfig(value: number): Promise<RecurringConfigResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }
    const safe = Math.max(0, Math.min(1000, Math.trunc(value) || 0))

    const { error: updateError } = await supabase
      .from('communities')
      .update({ recurring_points_per_day: safe })
      .eq('id', communityId)

    if (updateError) return { error: 'Não foi possível salvar a configuração agora.' }

    setRecurringPerDay(safe)
    await fetchAll()
    return { error: null }
  }

  return {
    summary,
    memberBalances,
    ledger,
    recurringPerDay,
    communityName,
    loading,
    error,
    awardManual,
    setRecurringConfig,
    refresh: fetchAll,
  }
}
