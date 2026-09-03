import { useState } from 'react'
import circulaIcon from '../assets/circula-icon.jpg'
import type { Profile, ProfileUpdateInput } from '../types/profile'
import { useCommunity } from '../hooks/useCommunity'
import { useCircles } from '../hooks/useCircles'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { MemberList } from './MemberList'
import { AddMemberForm } from './AddMemberForm'
import { MyProfile } from './MyProfile'
import { ProfileCard } from './ProfileCard'
import { Feed } from './Feed'
import { CircleList } from './CircleList'
import { CircleDetail } from './CircleDetail'
import { EventList } from './EventList'
import { useEvents } from '../hooks/useEvents'
import { RecipeList } from './RecipeList'
import { useRecipes } from '../hooks/useRecipes'
import { SavedItems } from './SavedItems'
import { useSavedItems } from '../hooks/useSavedItems'
import { NotificationBell } from './NotificationBell'
import { Messages } from './Messages'
import { useConversations } from '../hooks/useConversations'
import { ProductManager } from './ProductManager'
import { ProfessionalPanel } from './ProfessionalPanel'
import { MasterPanel } from './MasterPanel'
import { MemberCommunityCard } from './MemberCommunityCard'
import { HomeToday } from './HomeToday'
import { PrimaryNav } from './PrimaryNav'
import { DashboardRail } from './DashboardRail'
import { useRailSummary } from '../hooks/useRailSummary'
import type { NavItem, NavKey } from './PrimaryNav'
import {
  CalendarIcon,
  CirclesIcon,
  CommunitiesIcon,
  FeedIcon,
  HomeIcon,
  MessageIcon,
  PanelIcon,
  RecipeIcon,
  StoreIcon,
  UserIcon,
} from './icons'

interface DashboardProps {
  profile: Profile | null
  onSignOut: () => void
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<{
    error: string | null
  }>
  onUploadAvatar: (file: File) => Promise<{ error: string | null }>
  activeNav: NavKey
  onNavigate: (key: NavKey) => void
}

export function Dashboard({
  profile,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
  activeNav,
  onNavigate,
}: DashboardProps) {
  const {
    communities,
    memberCounts,
    loading,
    error,
    createCommunity,
    addMember,
    joinCommunity,
    setCommunityCover,
  } = useCommunity(profile)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [feedRefreshToken, setFeedRefreshToken] = useState(0)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null)
  const [circlesCommunityId, setCirclesCommunityId] = useState<string | null>(null)

  const myCommunities = communities.filter((community) =>
    community.community_members.some((member) => member.profile?.id === profile?.id),
  )
  const discoverableCommunities = communities.filter(
    (community) =>
      !community.community_members.some((member) => member.profile?.id === profile?.id),
  )

  // Contexto de comunidade para o destino "Círculos". Um membro pode
  // participar de várias comunidades — se houver só uma relevante,
  // resolve direto; se houver mais de uma, o usuário escolhe.
  const circlesRelevantCommunities =
    profile?.role === 'professional' ? communities : myCommunities
  const resolvedCirclesCommunityId =
    circlesCommunityId ??
    (circlesRelevantCommunities.length === 1 ? circlesRelevantCommunities[0].id : null)

  // Destinos de navegação: derivados só do papel e do estado que o
  // Dashboard já calcula. "Comunidade relevante" = comunidade própria
  // (professional) ou da qual participa (member).
  const relevantCommunityCount =
    profile?.role === 'professional'
      ? communities.length
      : profile?.role === 'member'
        ? myCommunities.length
        : 0
  const hasSingleRelevantCommunity = relevantCommunityCount === 1

  // Loja e Painel só quando há exatamente 1 comunidade relevante. São
  // destinos da anfitriã: usam o mesmo <ProductManager canManage /> e o
  // <ProfessionalPanel> que já existiam, sem novas regras de acesso.
  const canHostDestinations = profile?.role === 'professional' && hasSingleRelevantCommunity

  const navItems: NavItem[] = [
    { key: 'inicio', label: 'Início', Icon: HomeIcon, inBottomNav: true },
  ]
  if (profile?.role === 'member' || (profile?.role === 'professional' && communities.length > 0)) {
    navItems.push({
      key: 'feed',
      label: 'Feed',
      Icon: FeedIcon,
      inBottomNav: true,
    })
    navItems.push({
      key: 'comunidades',
      label: 'Comunidades',
      Icon: CommunitiesIcon,
      inBottomNav: true,
    })
    navItems.push({
      key: 'circulos',
      label: 'Círculos',
      Icon: CirclesIcon,
      inBottomNav: true,
    })
    navItems.push({
      key: 'receitas',
      label: 'Receitas',
      Icon: RecipeIcon,
      inBottomNav: false,
    })
    navItems.push({
      key: 'eventos',
      label: 'Eventos',
      Icon: CalendarIcon,
      inBottomNav: false,
    })
    navItems.push({
      key: 'mensagens',
      label: 'Mensagens',
      Icon: MessageIcon,
      inBottomNav: false,
    })
    // Módulo 7 (Salvos) despriorizado na Fase 1: fora da navegação
    // primária. Componente e hook mantidos no código, dormentes.
  }
  if (canHostDestinations) {
    navItems.push({ key: 'painel', label: 'Painel', Icon: PanelIcon, inBottomNav: true })
    navItems.push({ key: 'loja', label: 'Loja', Icon: StoreIcon, inBottomNav: false })
  }
  if (profile) {
    navItems.push({ key: 'perfil', label: 'Meu perfil', Icon: UserIcon, inBottomNav: true })
  }

  const effectiveNav: NavKey = navItems.some((item) => item.key === activeNav)
    ? activeNav
    : 'inicio'

  // Trilho direito (>= 1280px): só na Home de member/professional, ao
  // lado da HomeToday. Master mantém a grade de comunidades sem trilho.
  // Usa apenas dados já calculados aqui — sem hook/consulta nova.
  const railCommunity =
    profile?.role === 'professional'
      ? (communities[0] ?? null)
      : profile?.role === 'member'
        ? (myCommunities[0] ?? null)
        : null

  // Fase 10 — resumo leve do trilho direito (pontos / conquistas /
  // próximo evento). Só busca quando faz sentido: member ou professional,
  // com comunidade, na Home. useRailSummary(null,null) não faz fetch.
  const railActive =
    !!railCommunity && profile?.role !== 'master' && activeNav === 'inicio'
  const railSummary = useRailSummary(
    railActive ? railCommunity.id : null,
    railActive ? (profile?.id ?? null) : null,
  )

  // Círculos da comunidade resolvida — só busca quando o destino
  // "Círculos" ou "Eventos" está ativo (useCircles(null) não faz fetch).
  // Eventos reaproveita a mesma resolução de comunidade dos círculos.
  const circlesActive =
    effectiveNav === 'circulos' ||
    effectiveNav === 'eventos'
  const {
    circles,
    loading: circlesLoading,
    error: circlesError,
    joinCircle,
    leaveCircle,
  } = useCircles(circlesActive ? resolvedCirclesCommunityId : null)

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    rsvp: eventRsvp,
    cancelRsvp: eventCancelRsvp,
  } = useEvents(effectiveNav === 'eventos' ? resolvedCirclesCommunityId : null)

  // Fase 2 — RECEITAS: destino próprio, alimentado por useRecipes
  // (extensão de community_content, type='recipe'). Só busca quando o
  // destino está ativo.
  const {
    recipes,
    loading: recipesLoading,
    error: recipesError,
  } = useRecipes(effectiveNav === 'receitas' ? resolvedCirclesCommunityId : null)

  // Módulo 7 — Salvos: DESPRIORIZADO na Fase 1. O hook fica dormente
  // (profileId null = sem fetch) e os botões "Salvar" saem de
  // ContentLibrary/EventList. O componente SavedItems e o hook seguem
  // no código, prontos para reativação numa etapa futura.
  const savedItems = useSavedItems(null)

  // Mensagens: instância única de useConversations (badge + lista +
  // Realtime). Master fica de fora (profileId null = sem fetch).
  const conversationsEnabled = !!profile && profile.role !== 'master'
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    totalUnread,
    refresh: refreshConversations,
    startConversation,
  } = useConversations(conversationsEnabled ? profile.id : null)

  async function openConversationWith(otherProfileId: string) {
    const { id, error: startErr } = await startConversation(otherProfileId)
    if (startErr || !id) return
    setViewingProfileId(null)
    setPendingConversationId(id)
    onNavigate('mensagens')
  }

  function openConversationById(conversationId: string) {
    setPendingConversationId(conversationId)
    onNavigate('mensagens')
  }

  const selectedCircle =
    selectedCircleId !== null
      ? (circles.find((circle) => circle.id === selectedCircleId) ?? null)
      : null
  const circlesCommunity =
    communities.find((community) => community.id === resolvedCirclesCommunityId) ?? null

  function refreshFeed() {
    setFeedRefreshToken((token) => token + 1)
  }

  // Ao clicar em "Círculos" na navegação, sempre volta para a lista.
  function handleNavigate(key: NavKey) {
    if (key === 'circulos') setSelectedCircleId(null)
    onNavigate(key)
  }

  function renderDestination() {
    if (!profile) return null

    // FASE 2 · ITEM 2 — "Seu Círcula de hoje": dashboard pessoal no
    // destino "Início" para member e professional. master mantém a
    // visão atual (grade de comunidades) — não é membro de comunidade.
    if (effectiveNav === 'inicio' && profile.role !== 'master') {
      return (
        <HomeToday
          profile={profile}
          communities={communities}
          discoverableCommunities={discoverableCommunities}
          memberCounts={memberCounts}
          onCreateCommunity={createCommunity}
          onNavigate={handleNavigate}
          onOpenConversation={openConversationById}
        />
      )
    }

    if (effectiveNav === 'perfil') {
      return (
        <MyProfile profile={profile} onUpdate={onUpdateProfile} onUploadAvatar={onUploadAvatar} />
      )
    }

    if (effectiveNav === 'mensagens') {
      return (
        <Messages
          myProfileId={profile.id}
          conversations={conversations}
          loading={conversationsLoading}
          error={conversationsError}
          initialConversationId={pendingConversationId}
          onConsumedInitial={() => setPendingConversationId(null)}
          onStartConversation={startConversation}
          onActivity={refreshConversations}
        />
      )
    }

    if (effectiveNav === 'salvos') {
      return <SavedItems profileId={profile.id} savedItems={savedItems} />
    }

    // A1 (Módulo 6) — Feed da comunidade como destino próprio para
    // member e professional (Master mantém sua grade em `inicio`).
    // Reaproveita a resolução de comunidade dos círculos/eventos e o
    // `feedRefreshToken` já existente. Sem circleId => feed da
    // comunidade (`circle_id IS NULL`) — isolamento community/circle
    // preservado. Não toca Feed.tsx / usePosts.ts.
    if (effectiveNav === 'feed') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            <p className="section-label">Feed · escolha uma comunidade</p>
            <div className="community-picker">
              {circlesRelevantCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCirclesCommunityId(community.id)}
                >
                  {community.name}
                </button>
              ))}
            </div>
          </>
        )
      }

      const feedCommunity = communities.find(
        (community) => community.id === resolvedCirclesCommunityId,
      )
      if (!feedCommunity) {
        return <p>Comunidade não encontrada.</p>
      }

      const isOwner = profile.role === 'professional'

      return (
        <>
          <p className="section-label">
            Feed
            {circlesRelevantCommunities.length > 1 ? ` · ${feedCommunity.name}` : ''}
          </p>
          <CommunityView
            community={feedCommunity}
            memberCount={memberCounts[feedCommunity.id]}
            badge={
              isOwner
                ? 'Você é a anfitriã desta comunidade'
                : 'Você participa desta comunidade'
            }
            onSetCover={
              isOwner ? (url) => setCommunityCover(feedCommunity.id, url) : undefined
            }
            ownerId={profile.id}
          />
          <Feed
            communityId={feedCommunity.id}
            authorId={profile.id}
            canPost={profile.role !== 'master'}
            refreshToken={feedRefreshToken}
          />
        </>
      )
    }

    if (effectiveNav === 'circulos') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            <p className="section-label">Círculos · escolha uma comunidade</p>
            <div className="community-picker">
              {circlesRelevantCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCirclesCommunityId(community.id)}
                >
                  {community.name}
                </button>
              ))}
            </div>
          </>
        )
      }

      if (selectedCircle) {
        return (
          <CircleDetail
            circle={selectedCircle}
            profileId={profile.id}
            communityId={resolvedCirclesCommunityId}
            communityName={circlesCommunity?.name}
            isParticipating={selectedCircle.members.some(
              (member) => member.profile_id === profile.id,
            )}
            onBack={() => setSelectedCircleId(null)}
            onJoin={() => joinCircle(selectedCircle.id, profile.id)}
            onLeave={() => leaveCircle(selectedCircle.id, profile.id)}
          />
        )
      }

      return (
        <CircleList
          circles={circles}
          loading={circlesLoading}
          error={circlesError}
          profileId={profile.id}
          communityName={
            circlesRelevantCommunities.length > 1 ? circlesCommunity?.name : undefined
          }
          onChangeCommunity={
            circlesRelevantCommunities.length > 1
              ? () => setCirclesCommunityId(null)
              : undefined
          }
          onOpenCircle={(id) => setSelectedCircleId(id)}
          onJoin={(id) => joinCircle(id, profile.id)}
          onLeave={(id) => leaveCircle(id, profile.id)}
        />
      )
    }

    if (effectiveNav === 'eventos') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            <p className="section-label">Eventos · escolha uma comunidade</p>
            <div className="community-picker">
              {circlesRelevantCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCirclesCommunityId(community.id)}
                >
                  {community.name}
                </button>
              ))}
            </div>
          </>
        )
      }

      return (
        <EventList
          events={events}
          loading={eventsLoading}
          error={eventsError}
          profileId={profile.id}
          circles={circles}
          canRsvp={profile.role !== 'master'}
          communityName={
            circlesRelevantCommunities.length > 1 ? circlesCommunity?.name : undefined
          }
          onRsvp={(id) => eventRsvp(id, profile.id)}
          onCancelRsvp={(id) => eventCancelRsvp(id, profile.id)}
        />
      )
    }

    if (effectiveNav === 'receitas') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            <p className="section-label">Receitas · escolha uma comunidade</p>
            <div className="community-picker">
              {circlesRelevantCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCirclesCommunityId(community.id)}
                >
                  {community.name}
                </button>
              ))}
            </div>
          </>
        )
      }

      return (
        <RecipeList
          recipes={recipes}
          loading={recipesLoading}
          error={recipesError}
          canSeeUnpublished={profile.role === 'professional'}
          communityName={
            circlesRelevantCommunities.length > 1 ? circlesCommunity?.name : undefined
          }
        />
      )
    }

    if (profile.role === 'professional') {
      if (communities.length === 0) {
        return (
          <>
            <p className="section-label">Minha comunidade</p>
            <CreateCommunityForm onCreate={createCommunity} />
          </>
        )
      }

      const community = communities[0]

      if (effectiveNav === 'painel') {
        return (
          <ProfessionalPanel
            communityId={community.id}
            profileId={profile.id}
            onFeedRefresh={refreshFeed}
            onOpenConversation={openConversationById}
          />
        )
      }

      if (effectiveNav === 'loja') {
        return (
          <ProductManager communityId={community.id} profileId={profile.id} canManage />
        )
      }

      if (effectiveNav === 'comunidades') {
        return (
          <>
            <p className="section-label">Participantes</p>
            <AddMemberForm onAdd={(email) => addMember(community.id, email)} />
            <MemberList
              members={community.community_members}
              onSelectMember={setViewingProfileId}
            />
          </>
        )
      }

      return (
        <>
          <p className="section-label">Minha comunidade</p>
          <CommunityView
            community={community}
            memberCount={memberCounts[community.id]}
            badge="Você é a anfitriã desta comunidade"
            onSetCover={(url) => setCommunityCover(community.id, url)}
            ownerId={profile.id}
          />
          <Feed
            communityId={community.id}
            authorId={profile.id}
            canPost
            refreshToken={feedRefreshToken}
          />
        </>
      )
    }

    if (profile.role === 'master') {
      // Fase 9 — o Master vê a plataforma por agregados (MasterPanel),
      // não mais o espelho por-comunidade com Feed/managers/lista de
      // membros. Nenhum conteúdo ou dado individual de usuária.
      return <MasterPanel />
    }

    // member
    if (effectiveNav === 'comunidades') {
      return (
        <>
          {myCommunities.length > 0 && (
            <>
              <p className="section-label">Minhas comunidades</p>
              <div className="community-grid">
                {myCommunities.map((community) => (
                  <CommunityView
                    key={community.id}
                    community={community}
                    memberCount={memberCounts[community.id]}
                  />
                ))}
              </div>
            </>
          )}

          {discoverableCommunities.length > 0 ? (
            <>
              <p className="section-label">Descobrir comunidades</p>
              <div className="community-grid">
                {discoverableCommunities.map((community) => (
                  <CommunityView
                    key={community.id}
                    community={community}
                    memberCount={memberCounts[community.id]}
                    onJoin={() => joinCommunity(community.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            myCommunities.length === 0 && <p>Nenhuma comunidade disponível.</p>
          )}
        </>
      )
    }

    return (
      <>
        <p className="section-label">Minha comunidade</p>
        {myCommunities.length === 0 ? (
          <p>Você ainda não faz parte de nenhuma comunidade.</p>
        ) : (
          <div className="community-grid">
            {myCommunities.map((community) => (
              <MemberCommunityCard
                key={community.id}
                community={community}
                profile={profile}
                memberCount={memberCounts[community.id]}
                feedRefreshToken={feedRefreshToken}
                onFeedRefresh={refreshFeed}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  const showRail =
    !viewingProfileId && effectiveNav === 'inicio' && profile?.role !== 'master'

  return (
    <section className={`dashboard${showRail ? ' dashboard--rail' : ''}`}>
      <header className="dashboard-header">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <div className="brand-lockup">
            <h1 className="brand-name">Círcula</h1>
            <p className="brand-tagline">Conectando Mulheres</p>
          </div>
        </div>

        <div className="dashboard-user">
          {profile && profile.role !== 'master' && (
            <NotificationBell
              profileId={profile.id}
              onNavigate={handleNavigate}
              onOpenConversation={openConversationById}
            />
          )}
          <span className="dashboard-user-avatar" aria-hidden="true">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span>{(profile?.full_name ?? 'U').charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className="dashboard-user-name">
            Olá, <strong>{profile?.full_name ?? 'usuária'}</strong>
          </span>
          <button type="button" onClick={onSignOut}>
            Sair
          </button>
        </div>
      </header>

      <PrimaryNav
        items={navItems}
        active={effectiveNav}
        onNavigate={handleNavigate}
        onPlus={() => handleNavigate(profile?.role === 'master' ? 'inicio' : 'feed')}
        plusLabel={profile?.role === 'master' ? 'Ir para o Início' : 'Abrir o Feed'}
        badges={{ mensagens: totalUnread }}
      />

      {viewingProfileId ? (
        <div className="dashboard-main dashboard-main-solo">
          <ProfileCard
            profileId={viewingProfileId}
            onClose={() => setViewingProfileId(null)}
            onStartConversation={
              conversationsEnabled && viewingProfileId !== profile?.id
                ? openConversationWith
                : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="dashboard-main">
            <div className="community-area">
              {loading && <p>Carregando comunidade...</p>}

              {!loading && error && <p className="auth-error">{error}</p>}

              {!loading && !error && renderDestination()}
            </div>
          </div>

          {showRail && (
            <DashboardRail
              communityName={railCommunity?.name}
              communityCoverUrl={railCommunity?.cover_image_url}
              memberCount={railCommunity ? memberCounts[railCommunity.id] : undefined}
              unreadMessages={totalUnread}
              pointsBalance={railSummary.pointsBalance}
              achievementsCount={railSummary.achievementsCount}
              nextEvent={railSummary.nextEvent}
              onNavigate={handleNavigate}
            />
          )}
        </>
      )}
    </section>
  )
}
