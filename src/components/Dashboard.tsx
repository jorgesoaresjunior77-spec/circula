import { useState } from 'react'
import circulaIcon from '../assets/circula-icon.png'
import circulaLogo from '../assets/circula-logo.png'
import type { Profile, ProfileUpdateInput } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import { useCommunity } from '../hooks/useCommunity'
import { useCircles } from '../hooks/useCircles'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { MemberList } from './MemberList'
import { AddMemberForm } from './AddMemberForm'
import { InviteMemberForm } from './InviteMemberForm'
import { MyProfile } from './MyProfile'
import { ProfileCard } from './ProfileCard'
import { Feed } from './Feed'
import { CircleList } from './CircleList'
import { CircleDetail } from './CircleDetail'
import { EventList } from './EventList'
import { useEvents } from '../hooks/useEvents'
import { SavedItems } from './SavedItems'
import { useSavedItems } from '../hooks/useSavedItems'
import { NotificationBell } from './NotificationBell'
import { Messages } from './Messages'
import { useConversations } from '../hooks/useConversations'
import { ProductManager } from './ProductManager'
import { ProfessionalPanel } from './ProfessionalPanel'
import { PlatformTrialBanner } from './PlatformTrialBanner'
import { MasterPanel } from './MasterPanel'
import { MemberCommunityCard } from './MemberCommunityCard'
import { PendingMembershipRequests } from './PendingMembershipRequests'
import { HomeToday } from './HomeToday'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { PrimaryNav } from './PrimaryNav'
import { DashboardRail } from './DashboardRail'
import { useRailSummary } from '../hooks/useRailSummary'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import type { NavItem, NavKey } from './PrimaryNav'
import {
  CalendarIcon,
  CirclesIcon,
  CommunitiesIcon,
  FeedIcon,
  HomeIcon,
  MessageIcon,
  PanelIcon,
  StoreIcon,
  UserIcon,
} from './icons'

// Fase 7 — só a quantidade para preencher a largura da grade real
// (.community-grid vira 3 colunas no desktop); puramente decorativo.
const COMMUNITY_LOADING_KEYS = ['a', 'b', 'c']

// Skeleton editorial exclusivo da tela Comunidades do Member (Fase 7).
// Puramente apresentacional — nenhum dado novo, nenhuma lógica; usado
// só quando `effectiveNav === 'comunidades'` e `profile.role ===
// 'member'` durante o `loading` já existente de useCommunity. O
// Professional continua com o texto genérico de sempre (item 5 da
// fase: nenhum estado novo para ele).
function CommunityLoadingSkeleton() {
  return (
    <div className="community-loading" aria-hidden="true">
      <span className="community-loading-line community-loading-line--heading" />
      <div className="community-grid">
        {COMMUNITY_LOADING_KEYS.map((key) => (
          <div key={`minhas-${key}`} className="community-loading-card">
            <span className="community-loading-media" />
            <span className="community-loading-line community-loading-line--title" />
            <span className="community-loading-line community-loading-line--meta" />
          </div>
        ))}
      </div>
      <span className="community-loading-line community-loading-line--heading" />
      <div className="community-grid">
        {COMMUNITY_LOADING_KEYS.map((key) => (
          <div key={`descobrir-${key}`} className="community-loading-card">
            <span className="community-loading-media" />
            <span className="community-loading-line community-loading-line--title" />
            <span className="community-loading-line community-loading-line--meta" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface CommunityPickerOptionProps {
  community: CommunityWithMembers
  memberCount?: number
  onSelect: () => void
}

// Redesign do community-picker (Fase 5): componente próprio (não
// exportado, só deste arquivo) exigido pelas regras de hooks do React
// — `useSignedImageUrl` precisa rodar uma vez por item da lista, o que
// não é possível dentro do `.map()` do componente pai. Só apresentação:
// nenhum dado novo (usa `cover_image_url`/`memberCount` já carregados),
// nenhuma query, callback recebido de fora sem alteração.
function CommunityPickerOption({ community, memberCount, onSelect }: CommunityPickerOptionProps) {
  const { url: coverUrl } = useSignedImageUrl(community.cover_image_url)

  return (
    <button type="button" className="community-picker-card" onClick={onSelect}>
      <span className="community-picker-card-media" aria-hidden="true">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span className="community-picker-card-fallback">
            {community.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="community-picker-card-body">
        <span className="community-picker-card-name">{community.name}</span>
        <span className="community-picker-card-meta">
          {memberCount != null
            ? `${memberCount} ${memberCount === 1 ? 'pessoa' : 'pessoas'}`
            : 'Selecionar comunidade'}
        </span>
      </span>
      <span className="community-picker-card-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}

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
    inviteMember,
    joinCommunity,
    approveMembershipRequest,
    rejectMembershipRequest,
    setCommunityCover,
    updateCommunity,
  } = useCommunity(profile)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [feedRefreshToken, setFeedRefreshToken] = useState(0)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null)
  const [circlesCommunityId, setCirclesCommunityId] = useState<string | null>(null)

  // Redesign do community-picker (Fase 5) — só a apresentação dos 4
  // blocos idênticos (Feed/Círculos/Eventos/Loja); `onSelect` é sempre
  // o mesmo callback que cada chamador já usa hoje (`setCirclesCommunityId`),
  // passado como parâmetro, sem alteração nenhuma de comportamento.
  function renderCommunityPicker(
    label: string,
    items: CommunityWithMembers[],
    onSelect: (communityId: string) => void,
  ) {
    return (
      <>
        <p className="section-label">{label}</p>
        <div className="community-picker">
          {items.map((community) => (
            <CommunityPickerOption
              key={community.id}
              community={community}
              memberCount={memberCounts[community.id]}
              onSelect={() => onSelect(community.id)}
            />
          ))}
        </div>
      </>
    )
  }

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
      key: 'eventos',
      label: 'Eventos',
      Icon: CalendarIcon,
      inBottomNav: false,
    })
    // Fase 13 — Loja acessível também à Member (antes só existia como
    // destino da anfitriã, dentro de canHostDestinations). Backend/RLS
    // e o componente já suportavam a Member comprar (ProductManager
    // canBuy, já usado dentro de MemberCommunityCard) — faltava só
    // este item de navegação. Mesma resolução de comunidade de
    // círculos/eventos/receitas (community-picker quando houver mais
    // de uma).
    navItems.push({
      key: 'loja',
      label: 'Loja',
      Icon: StoreIcon,
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

  // C1 — Hero full-bleed da comunidade: a capa da comunidade em foco
  // vira a fotografia protagonista da entrada da Home. Só quando há capa
  // real; sem capa, o cabeçalho segue no formato atual. A URL assinada
  // reusa o mesmo hook de imagem já usado no HomeCommunityHeader — sem
  // consulta nova, sem campo novo, sem hook de negócio.
  const { url: heroCoverUrl } = useSignedImageUrl(railCommunity?.cover_image_url ?? null)

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
          coverHero={coverHero}
          railSummary={
            railActive
              ? {
                  pointsBalance: railSummary.pointsBalance,
                  achievementsCount: railSummary.achievementsCount,
                  nextEvent: railSummary.nextEvent,
                }
              : null
          }
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
            {renderCommunityPicker(
              'Feed · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
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
          <div className="feed-masthead">
            <p className="section-label">Feed</p>
            <h2 className="feed-masthead-title">{feedCommunity.name}</h2>
          </div>
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
            authorName={profile.full_name}
            authorAvatarUrl={profile.avatar_url}
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
            {renderCommunityPicker(
              'Círculos · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
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
            {renderCommunityPicker(
              'Eventos · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
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

    // Fase 13 — Loja: destino único para dona (gerencia) e Member
    // (compra), mesmo componente/lógica de sempre (ProductManager),
    // só decidindo canManage/canBuy pelo papel. RLS de `products` já
    // restringe a Member a `status='published'` (products_select) —
    // nenhuma alteração de banco necessária.
    if (effectiveNav === 'loja') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            {renderCommunityPicker(
              'Loja · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
          </>
        )
      }

      const isOwner = profile.role === 'professional'

      return (
        <ProductManager
          communityId={resolvedCirclesCommunityId}
          profileId={profile.id}
          canManage={isOwner}
          canBuy={!isOwner}
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
            community={community}
            profileId={profile.id}
            onFeedRefresh={refreshFeed}
            onApproveMembership={approveMembershipRequest}
            onRejectMembership={rejectMembershipRequest}
            onUpdateCommunity={updateCommunity}
          />
        )
      }

      if (effectiveNav === 'comunidades') {
        return (
          <>
            <div className="community-masthead">
              <p className="community-masthead-eyebrow">Comunidades</p>
              <h1 className="community-masthead-title">Sua comunidade, em um só lugar</h1>
              <p className="community-masthead-intro">
                Acompanhe pedidos de entrada, convide novas pessoas e conheça quem já faz
                parte de {community.name}.
              </p>
            </div>

            <div className="community-pro-hero">
              <CommunityView
                community={community}
                memberCount={memberCounts[community.id]}
                badge="Você é a anfitriã desta comunidade"
                onSetCover={(url) => setCommunityCover(community.id, url)}
                ownerId={profile.id}
              />
            </div>

            <div className="community-pro-block">
              <PendingMembershipRequests
                communityId={community.id}
                communityName={community.name}
                members={community.community_members}
                onApprove={approveMembershipRequest}
                onReject={rejectMembershipRequest}
                variant="editorial"
              />
            </div>

            <div className="community-pro-block">
              <p className="community-pro-block-eyebrow">Convite</p>
              <InviteMemberForm
                onInvite={(email, fullName) => inviteMember(community.id, email, fullName)}
              />
            </div>

            <div className="community-pro-block">
              <p className="community-pro-block-eyebrow">Adição direta</p>
              <AddMemberForm onAdd={(email) => addMember(community.id, email)} />
            </div>

            <div className="community-pro-block">
              <p className="community-pro-block-eyebrow">Comunidade</p>
              <MemberList
                members={community.community_members}
                onSelectMember={setViewingProfileId}
              />
            </div>
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
            authorName={profile.full_name}
            authorAvatarUrl={profile.avatar_url}
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
          <div className="community-masthead">
            <p className="community-masthead-eyebrow">Comunidades</p>
            <h1 className="community-masthead-title">Encontre seu espaço no Círcula</h1>
            <p className="community-masthead-intro">
              Cada comunidade é um jeito diferente de viver o Círcula — escolha onde já
              está, ou descubra um novo espaço para chamar de seu.
            </p>
          </div>

          {myCommunities.length > 0 ? (
            <>
              <p className="section-label">Minhas comunidades</p>
              <div className="community-grid">
                {myCommunities.map((community) => (
                  <CommunityView
                    key={community.id}
                    community={community}
                    memberCount={memberCounts[community.id]}
                    variant="grid"
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="community-empty">
              <p className="community-empty-eyebrow">Minhas comunidades</p>
              <p className="community-empty-title">
                Você ainda não participa de nenhuma comunidade
              </p>
              <p className="community-empty-text">
                Descubra abaixo um espaço que combine com o seu momento.
              </p>
            </div>
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
                    variant="grid"
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="community-empty">
              <p className="community-empty-eyebrow">Descobrir comunidades</p>
              <p className="community-empty-title">
                Nenhuma comunidade nova para descobrir agora
              </p>
              <p className="community-empty-text">
                Você já faz parte de tudo que temos por perto. Volte em breve para ver
                novidades.
              </p>
            </div>
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

  // C1 — só ativa o hero fotográfico quando a Home está visível E há uma
  // capa real para ser protagonista. Sem capa, tudo segue como antes.
  const coverHero = showRail && !!railCommunity?.cover_image_url

  return (
    <section
      className={`dashboard${showRail ? ' dashboard--rail' : ''}${
        coverHero ? ' dashboard--cover-hero' : ''
      }`}
    >
      {coverHero && railCommunity && (
        <div className="cover-hero">
          {heroCoverUrl && (
            <img src={heroCoverUrl} alt="" className="cover-hero-photo" />
          )}
          <span className="cover-hero-scrim" aria-hidden="true" />
          {/* Identidade da comunidade ancorada na base da foto — mesmos
              dados e semântica do HomeCommunityHeader, em modo sobreposição
              (sem repetir a foto). Renderizado aqui, dentro do hero, para
              o nome ficar SEMPRE sobre a fotografia, independente do que
              houver acima (faixa de trial etc.). */}
          <div className="cover-hero-identity">
            <HomeCommunityHeader
              community={railCommunity}
              memberCount={memberCounts[railCommunity.id]}
              overlay
            />
          </div>
        </div>
      )}
      <header className="dashboard-header">
        <div className="brand">
          <button
            type="button"
            className="brand-icon-btn"
            onClick={() => handleNavigate('inicio')}
            aria-label="Ir para o Início"
          >
            <img src={circulaIcon} alt="" className="brand-icon" />
          </button>
          <div className="brand-lockup">
            <h1 className="brand-name">Círcula</h1>
            <p className="brand-tagline">Conectando Mulheres</p>
          </div>
          {/* B1 — logo oficial na navegação superior (desktop, onde há
              espaço). Mesma ação "ir para o Início". No mobile a marca
              segue como pastilha + wordmark acima. */}
          <button
            type="button"
            className="brand-mark-btn"
            onClick={() => handleNavigate('inicio')}
            aria-label="Ir para o Início"
          >
            <img src={circulaLogo} alt="Círcula" className="brand-mark" />
          </button>
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
              {loading &&
                (effectiveNav === 'comunidades' && profile?.role === 'member' ? (
                  <CommunityLoadingSkeleton />
                ) : (
                  <p>Carregando comunidade...</p>
                ))}

              {!loading && error && <p className="auth-error">{error}</p>}

              {/* FASE 15.2 (G1) — status do trial de plataforma + CTA de
                  assinatura, visível em qualquer destino do Professional.
                  Renderiza null fora dos estados de trial/pendência. */}
              {!loading && !error && profile?.role === 'professional' && <PlatformTrialBanner />}

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
