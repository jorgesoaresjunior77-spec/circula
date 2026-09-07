import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/profile'
import type {
  AddMemberResult,
  CommunityUpdateInput,
  CommunityWithMembers,
  InviteMemberResult,
  JoinResult,
} from '../types/community'

const COMMUNITY_SELECT =
  'id,name,slug,description,cover_image_url,owner_id,is_discoverable,created_at,community_members(id,status,joined_at,profile:profiles(id,full_name,avatar_url))'

export function useCommunity(profile: Profile | null) {
  const [communities, setCommunities] = useState<CommunityWithMembers[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommunities = useCallback(async () => {
    if (!profile) {
      setCommunities([])
      setMemberCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase.from('communities').select(COMMUNITY_SELECT)

    if (profile.role === 'professional') {
      query = query.eq('owner_id', profile.id)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setCommunities([])
      setMemberCounts({})
      setLoading(false)
      return
    }

    const list = (data as unknown as CommunityWithMembers[] | null) ?? []
    setCommunities(list)

    const countResults = await Promise.all(
      list.map((community) =>
        supabase.rpc('community_member_count', { p_community_id: community.id }),
      ),
    )

    const counts: Record<string, number> = {}
    list.forEach((community, index) => {
      const result = countResults[index]
      if (!result.error && typeof result.data === 'number') {
        counts[community.id] = result.data
      }
    })
    setMemberCounts(counts)

    setLoading(false)
  }, [profile?.id, profile?.role])

  useEffect(() => {
    fetchCommunities()
  }, [fetchCommunities])

  async function createCommunity(input: {
    name: string
    slug: string
    description: string
    cover_image_url?: string | null
  }) {
    if (!profile) return { error: 'Sem sessão ativa.' }

    const { data: created, error: insertError } = await supabase
      .from('communities')
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        cover_image_url: input.cover_image_url?.trim() || null,
        owner_id: profile.id,
      })
      .select('id')
      .single()

    if (insertError) {
      return { error: insertError.message }
    }

    const { error: membershipError } = await supabase.from('community_members').insert({
      community_id: created.id,
      profile_id: profile.id,
    })

    await fetchCommunities()

    if (membershipError) {
      return {
        error: `Comunidade criada, mas não foi possível te adicionar como membro: ${membershipError.message}`,
      }
    }

    return { error: null }
  }

  async function addMember(communityId: string, email: string): Promise<AddMemberResult> {
    const { data, error: searchError } = await supabase.rpc('find_member_by_email', {
      p_community_id: communityId,
      p_email: email,
    })

    if (searchError) {
      return { status: 'error', error: searchError.message }
    }

    const match = (data as { id: string; full_name: string | null }[] | null)?.[0] ?? null

    if (!match) {
      return { status: 'not_found' }
    }

    const { error: insertError } = await supabase.from('community_members').insert({
      community_id: communityId,
      profile_id: match.id,
    })

    if (insertError) {
      if (insertError.message.includes('duplicate key')) {
        return { status: 'already_member', fullName: match.full_name }
      }
      return { status: 'error', error: insertError.message }
    }

    await fetchCommunities()
    return { status: 'success', fullName: match.full_name }
  }

  // Fase 14.2 — convida uma nova participante por e-mail. Toda a parte
  // privilegiada (criar usuário de Auth, enviar o e-mail, vincular à
  // comunidade) fica na Edge Function `invite-member`; aqui só chamamos
  // e traduzimos a resposta. O `supabase-js` anexa o JWT da sessão
  // atual (a Professional) automaticamente na chamada.
  async function inviteMember(
    communityId: string,
    email: string,
    fullName: string,
  ): Promise<InviteMemberResult> {
    const { data, error: invokeError } = await supabase.functions.invoke('invite-member', {
      body: { communityId, email, fullName: fullName || undefined },
    })

    if (invokeError) {
      // Respostas != 2xx viram FunctionsHttpError; a mensagem real da
      // função vem no corpo JSON de `context` (um Response).
      let serverMessage: string | undefined
      const ctx = (invokeError as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = (await ctx.json()) as { error?: string }
          if (typeof body?.error === 'string') serverMessage = body.error
        } catch {
          serverMessage = undefined
        }
      }
      return {
        status: 'error',
        error: serverMessage ?? 'Não foi possível enviar o convite agora. Tente novamente.',
      }
    }

    const payload = data as { status?: string; fullName?: string | null } | null

    if (payload?.status === 'invited') {
      await fetchCommunities()
      return { status: 'invited' }
    }
    if (payload?.status === 'added_existing') {
      await fetchCommunities()
      return { status: 'added_existing', fullName: payload.fullName ?? null }
    }
    if (payload?.status === 'already_member') {
      return { status: 'already_member' }
    }
    return { status: 'error', error: 'Resposta inesperada do servidor.' }
  }

  async function joinCommunity(communityId: string): Promise<JoinResult> {
    if (!profile) return { status: 'error', error: 'Sem sessão ativa.' }

    // Fase 12.3: entrada em comunidade discoverable é sempre uma
    // SOLICITAÇÃO (status='pending'), nunca acesso imediato. A RLS
    // (community_members_insert) já exige status='pending' nesse ramo
    // e rejeita qualquer outro valor — manter explícito aqui também
    // para a intenção ficar clara e não depender só do default da
    // coluna (que continua 'active', usado pelos ramos dona/master).
    const { error: insertError } = await supabase.from('community_members').insert({
      community_id: communityId,
      profile_id: profile.id,
      status: 'pending',
    })

    if (insertError) {
      if (insertError.message.includes('duplicate key')) {
        return { status: 'already_member' }
      }
      return { status: 'error', error: insertError.message }
    }

    await fetchCommunities()
    return { status: 'pending' }
  }

  async function approveMembershipRequest(communityId: string, profileId: string) {
    const { error: rpcError } = await supabase.rpc('approve_membership_request', {
      p_community_id: communityId,
      p_profile_id: profileId,
    })

    if (rpcError) return { error: rpcError.message }

    await fetchCommunities()
    return { error: null }
  }

  async function rejectMembershipRequest(communityId: string, profileId: string) {
    const { error: rpcError } = await supabase.rpc('reject_membership_request', {
      p_community_id: communityId,
      p_profile_id: profileId,
    })

    if (rpcError) return { error: rpcError.message }

    await fetchCommunities()
    return { error: null }
  }

  async function setCommunityCover(communityId: string, coverImageUrl: string | null) {
    const value = coverImageUrl?.trim() ? coverImageUrl.trim() : null

    const { error: updateError } = await supabase
      .from('communities')
      .update({ cover_image_url: value })
      .eq('id', communityId)

    if (updateError) return { error: updateError.message }

    await fetchCommunities()
    return { error: null }
  }

  // 16.2.3-G — edição das informações básicas da comunidade (nome,
  // descrição, capa, is_discoverable). UPDATE direto em `communities`
  // sob a policy `communities_update` já existente (dona/master). `slug`
  // nunca entra no patch. Nenhuma RPC, migration ou RLS nova.
  async function updateCommunity(communityId: string, patch: CommunityUpdateInput) {
    const { error: updateError } = await supabase
      .from('communities')
      .update(patch)
      .eq('id', communityId)

    if (updateError) return { error: updateError.message }

    await fetchCommunities()
    return { error: null }
  }

  return {
    communities,
    memberCounts,
    loading,
    error,
    createCommunity,
    addMember,
    inviteMember,
    joinCommunity,
    approveMembershipRequest,
    rejectMembershipRequest,
    setCommunityCover,
    updateCommunity,
    refresh: fetchCommunities,
  }
}
