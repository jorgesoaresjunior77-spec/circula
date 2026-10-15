import { useMemo } from 'react'
import type { Profile } from '../types/profile'
import type { CommunityWithMembers, JoinResult } from '../types/community'
import type { NavKey } from './PrimaryNav'
import { useCircles } from '../hooks/useCircles'
import { useContent } from '../hooks/useContent'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { filterInstagramContent } from '../lib/instagramContent'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { HomeExperienceStrip } from './HomeExperienceStrip'
import { HomeCirclesSection } from './HomeCirclesSection'
import { HomeInstagramStrip } from './HomeInstagramStrip'

// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
//
// Dashboard pessoal do destino "Início" para member e professional.
// master NÃO chega aqui (o Dashboard exige role !== 'master').
//
// Redesign da Home (item 1/3/5) — "Atividade recente" saiu (a Home não
// mostra mais publicações/conversas/atividade do Feed; o Feed continua
// intacto e acessível pela navegação). Em consequência, `usePosts` e
// `useHomeToday` deixaram de ter qualquer consumidor aqui e saíram
// também — nenhum dos dois alimentava outra coisa nesta tela.

interface HomeTodayProps {
  profile: Profile
  /** Já filtrado por papel em useCommunity (professional: só a própria). */
  communities: CommunityWithMembers[]
  discoverableCommunities: CommunityWithMembers[]
  /** Contagem real de participantes por comunidade (useCommunity.memberCounts). */
  memberCounts: Record<string, number>

  onCreateCommunity: (input: {
    name: string
    slug: string
    description: string
    cover_image_url?: string | null
  }) => Promise<{ error: string | null }>
  /** Reorganização do menu — descoberta de comunidade (antes no destino
   *  "Comunidades", removido) virou parte deste fallback. Mesmo
   *  `joinCommunity` de sempre (useCommunity), só chamado daqui agora. */
  onJoinCommunity: (communityId: string) => Promise<JoinResult>
  onNavigate: (key: NavKey) => void
  /**
   * C1 — quando a capa da comunidade em foco está sendo usada como hero
   * fotográfico full-bleed (renderizado pelo Dashboard atrás do
   * cabeçalho), o HomeCommunityHeader entra em modo sobreposição: só a
   * identidade da comunidade sobre a foto, sem a própria capa/card.
   */
  coverHero?: boolean
  /**
   * C2 — resumo leve já calculado pelo Dashboard (useRailSummary): o
   * próximo evento. Alimenta a faixa editorial de experiências sem
   * nenhuma consulta nova aqui.
   */
  railSummary?: {
    nextEvent: { id: string; title: string; starts_at: string } | null
  } | null
}

function timeGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(fullName: string | null): string | null {
  const name = (fullName ?? '').trim().split(/\s+/)[0]
  return name || null
}

export function HomeToday({
  profile,
  communities,
  discoverableCommunities,
  memberCounts,
  onCreateCommunity,
  onJoinCommunity,
  onNavigate,
  coverHero = false,
  railSummary = null,
}: HomeTodayProps) {
  const myCommunities = useMemo(
    () =>
      communities.filter((community) =>
        community.community_members.some((member) => member.profile?.id === profile.id),
      ),
    [communities, profile.id],
  )

  // Comunidade em foco: a própria (professional) ou a primeira em que a
  // usuária participa (member). MVP sem seletor multi-comunidade.
  const focusCommunity =
    profile.role === 'professional'
      ? (communities[0] ?? null)
      : (myCommunities[0] ?? null)
  const communityId = focusCommunity?.id ?? null

  const { circles, joinCircle, leaveCircle } = useCircles(communityId)

  // No Instagram — publicações que a comunidade cadastrou como
  // community_content com link do Instagram + capa (useContent já
  // existe, sem consulta nova). Alimenta a faixa <HomeInstagramStrip>.
  const { items: contentItems } = useContent(communityId)
  const instagramPosts = useMemo(
    () => filterInstagramContent(contentItems),
    [contentItems],
  )

  // Capa (só VISUAL) que a Profissional cadastrou no Painel para o card
  // "Eventos" — único dos 6 cards fixos de Círcula Hoje cuja chave
  // segue válida no CHECK de community_card_images (ver
  // HomeExperienceStrip.tsx). Sem imagem cadastrada -> fallback
  // editorial (sem foto).
  const { images: cardImagePaths } = useCommunityCardImages(communityId)
  const { url: eventosCover } = useSignedImageUrl(cardImagePaths.eventos ?? null)
  // Ajustes de navegação — capa do card "Receitas", guardada sob a chave
  // legada 'jornada' (ver types/communityCards.ts).
  const { url: receitasCover } = useSignedImageUrl(cardImagePaths.jornada ?? null)

  const greetingName = firstName(profile.full_name)
  const greeting = (
    <header className="home-greeting">
      <h2 className="home-greeting-title">
        {timeGreeting()}
        {greetingName ? `, ${greetingName}` : ''}
      </h2>
      <p className="home-greeting-sub">Seu Círcula de hoje</p>
    </header>
  )

  // --- Sem comunidade: preserva os fallbacks do "Início" atual -------
  if (profile.role === 'professional' && communities.length === 0) {
    return (
      <div className="home">
        {greeting}
        <section className="home-section">
          <h3 className="home-section-title">Minha comunidade</h3>
          <CreateCommunityForm onCreate={onCreateCommunity} />
        </section>
      </div>
    )
  }

  if (!focusCommunity) {
    // Reorganização do menu — a descoberta de comunidade (antes um
    // destino de nav próprio, "Comunidades") vive aqui agora: é o único
    // lugar em que um Member sem nenhuma comunidade ainda precisa dela.
    // Mesmos dados (`discoverableCommunities`, já carregado por
    // useCommunity) e mesmo `onJoin` de sempre — só o local mudou.
    return (
      <div className="home">
        {greeting}
        <section className="community-card">
          <p>Você ainda não faz parte de nenhuma comunidade.</p>
        </section>
        {discoverableCommunities.length > 0 && (
          <section className="home-section">
            <h3 className="home-section-title">Descobrir comunidades</h3>
            <div className="community-grid">
              {discoverableCommunities.map((community) => (
                <CommunityView
                  key={community.id}
                  community={community}
                  memberCount={memberCounts[community.id]}
                  onJoin={() => onJoinCommunity(community.id)}
                  variant="grid"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="home">
      {greeting}

      {/* Fase 10 — cabeçalho da comunidade: capa, logo, nome, profissional
          responsável e nº de participantes. "Onde estou" claro logo na
          entrada. Somente leitura.
          C1 — quando a capa vira hero fotográfico full-bleed, esta
          identidade é renderizada pelo Dashboard DENTRO do hero (sobre a
          foto); aqui ela sai para não duplicar. */}
      {!coverHero && (
        <HomeCommunityHeader
          community={focusCommunity}
          memberCount={memberCounts[focusCommunity.id]}
          profileId={profile.id}
        />
      )}

      {/* Redesign da Home (item 3) — "Círcula Hoje": 5 destinos fixos de
          navegação (Meu Perfil, Help Nutri, Eventos, Loja, Círculos),
          sempre presentes. */}
      <HomeExperienceStrip
        nextEvent={railSummary?.nextEvent ?? null}
        eventosCover={eventosCover}
        receitasCover={receitasCover}
        onNavigate={onNavigate}
      />

      {/* C3 — Círculos da comunidade como coleção editorial, logo após a
          faixa de experiências. Só dados existentes (useCircles já
          instanciado); abrir leva ao destino "Círculos" como antes;
          joinCircle / leaveCircle preservados. */}
      <HomeCirclesSection
        circles={circles}
        profileId={profile.id}
        onOpen={() => onNavigate('circulos')}
        onJoin={(circleId) => joinCircle(circleId, profile.id)}
        onLeave={(circleId) => leaveCircle(circleId, profile.id)}
      />

      {/* Redesign da Home (item 5) — "No Instagram": terceira faixa,
          logo abaixo de Círculos. Mesmos dados do C4.1 (community_content
          publicado + link do Instagram); sem publicação real, mostra
          vagas vazias no lugar (item 1 da reorganização). */}
      <HomeInstagramStrip posts={instagramPosts} />

      <p className="home-institutional-note">
        O Círcula é um espaço de cuidado e amizade entre mulheres.
      </p>
    </div>
  )
}
