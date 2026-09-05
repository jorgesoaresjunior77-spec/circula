import { useEffect, useState } from 'react'
import circulaIcon from '../assets/circula-icon.jpg'
import { supabase } from '../lib/supabase'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import type { CommunityMemberProfile, CommunityWithMembers } from '../types/community'

interface HomeCommunityHeaderProps {
  community: CommunityWithMembers
  /**
   * Nº REAL de participantes da comunidade em foco — vem de
   * `useCommunity.memberCounts` (RPC `community_member_count`). É
   * obrigatório para uma Member: o array `community_members` embutido é
   * filtrado pela RLS (`community_members_select` só devolve a própria
   * linha), então `community_members.length` daria "1" para qualquer
   * Member. Nunca usar o length do embed como contagem.
   */
  memberCount?: number
}

/**
 * Fase 10 — cabeçalho da comunidade no topo da Home da usuária.
 * Enxuto e específico (não reaproveita o CommunityView inteiro): capa,
 * logo do Círcula, nome da comunidade, profissional responsável e o nº
 * de participantes. Visualmente forte, mas simples. Somente leitura —
 * nenhuma ação de dona (editar capa etc.).
 *
 * Origem dos dados (sempre a comunidade REAL em foco, nunca "a primeira"
 * nem valor fixo):
 *   - nome / capa / owner_id  → a própria linha de `community` (focus
 *     community escolhida na HomeToday a partir das comunidades em que a
 *     Member participa);
 *   - nº de participantes      → prop `memberCount` (RPC);
 *   - profissional responsável → o perfil de `community.owner_id`: já
 *     vem no embed quando quem olha é a dona/Master; para uma Member a
 *     RLS de `community_members` esconde a linha da dona, então buscamos
 *     `profiles` por `id = owner_id` (a policy `profiles_select` libera
 *     via `shares_active_community`). O filtro é sempre pelo owner_id
 *     exato — nunca um fallback que possa trazer outra pessoa.
 */
export function HomeCommunityHeader({ community, memberCount }: HomeCommunityHeaderProps) {
  const embeddedOwner =
    community.community_members.find((member) => member.profile?.id === community.owner_id)
      ?.profile ?? null

  const [fetchedOwner, setFetchedOwner] = useState<CommunityMemberProfile | null>(null)

  useEffect(() => {
    // Dona logada ou Master: o perfil da responsável já está no embed —
    // nada a buscar (e `owner` abaixo usa `embeddedOwner` de qualquer forma).
    if (embeddedOwner || !community.owner_id) return

    let active = true
    supabase
      .from('profiles')
      .select('id,full_name,avatar_url')
      .eq('id', community.owner_id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setFetchedOwner((data as CommunityMemberProfile | null) ?? null)
      })

    return () => {
      active = false
    }
  }, [community.owner_id, embeddedOwner])

  const owner = embeddedOwner ?? fetchedOwner
  const count = typeof memberCount === 'number' ? memberCount : null
  const { url: coverUrl } = useSignedImageUrl(community.cover_image_url)

  return (
    <section className="home-community-header" aria-label="Sua comunidade">
      <div className="home-community-cover" aria-hidden="true">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span className="home-community-cover-fallback" />
        )}
        <img src={circulaIcon} alt="" className="home-community-logo" />
      </div>

      <div className="home-community-info">
        <p className="home-community-eyebrow">Você está em</p>
        <h2 className="home-community-name">{community.name}</h2>
        <div className="home-community-meta">
          {owner && (
            <span className="home-community-owner">
              <span className="home-community-owner-avatar" aria-hidden="true">
                {owner.avatar_url ? (
                  <img src={owner.avatar_url} alt="" />
                ) : (
                  <span>{(owner.full_name ?? 'N').charAt(0).toUpperCase()}</span>
                )}
              </span>
              com {owner.full_name ?? 'sua nutricionista'}
            </span>
          )}
          {count !== null && (
            <span className="home-community-count">
              {count === 1 ? '1 mulher' : `${count} mulheres`}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
