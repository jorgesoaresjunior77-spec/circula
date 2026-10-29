import { Suspense, lazy, useState } from 'react'
import circulaIcon from '../assets/circula-icon.png'
import type { Profile, ProfileUpdateInput } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import { useCommunity } from '../hooks/useCommunity'
import { useCircles } from '../hooks/useCircles'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
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
// Code-splitting: ProfessionalPanel e MasterPanel só são necessários para
// os papéis professional/master, respectivamente — carregados sob
// demanda em vez de entrarem no bundle inicial de toda usuária (ver
// Suspense em volta de renderDestination() mais abaixo). Named export
// adaptado para `default` porque React.lazy exige esse formato.
//
// ProductManager NÃO entra nesse padrão (Fase 4 do code-splitting):
// testado como lazy() e o próprio Rollup confirmou, via o aviso
// INEFFECTIVE_DYNAMIC_IMPORT, que o módulo não sai do chunk principal —
// ele também é importado estaticamente por MemberCommunityCard.tsx (card
// padrão do Member) e por ProfessionalPanel.tsx, então fica alcançável
// de forma estática por outros caminhos de qualquer jeito. Revertido
// para import estático simples: sem esses dois outros pontos também
// virarem sob-demanda, o lazy() aqui só adiciona overhead sem adiar
// nenhum byte real.
const ProfessionalPanel = lazy(() =>
  import('./ProfessionalPanel').then((m) => ({ default: m.ProfessionalPanel })),
)
const MasterPanel = lazy(() =>
  import('./MasterPanel').then((m) => ({ default: m.MasterPanel })),
)
import { MemberCommunityCard } from './MemberCommunityCard'
import { HomeToday } from './HomeToday'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { PrimaryNav } from './PrimaryNav'
import { useRailSummary } from '../hooks/useRailSummary'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import type { NavItem, NavKey } from './PrimaryNav'
import {
  BookIcon,
  CalendarIcon,
  CirclesIcon,
  FeedIcon,
  HomeIcon,
  MessageIcon,
  PanelIcon,
  SproutIcon,
  StoreIcon,
  UserIcon,
} from './icons'
import { useContent } from '../hooks/useContent'
import { ContentLibrary } from './ContentLibrary'
import { GardenMemberView } from './GardenMemberView'

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
  /** Perfil (item 10) — upload cru de uma foto da galeria (bucket
   *  `avatars`, mesmo de sempre); devolve a URL pública, não toca
   *  `profiles` — MyProfile persiste o array via onUpdateProfile. */
  onUploadGalleryPhoto: (file: File) => Promise<{ url: string | null; error: string | null }>
  activeNav: NavKey
  onNavigate: (key: NavKey) => void
}

export function Dashboard({
  profile,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
  onUploadGalleryPhoto,
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
    // Reorganização do menu — "Comunidades" não existe mais como
    // destino independente: a gestão da comunidade mora no Painel
    // (abas Visão geral/Participantes, ver ProfessionalPanel.tsx) e o
    // Member chega ao conteúdo pelo Feed. Mantemos a NavKey 'comunidades'
    // no tipo (mesmo padrão dormente já usado para 'salvos'), mas ela
    // nunca mais é empurrada para `navItems`.
    navItems.push({
      key: 'circulos',
      label: 'Círculos',
      Icon: CirclesIcon,
      // Navegação principal agora é só Início/Feed/Painel/Perfil —
      // Círculos sai da barra inferior fixa e passa a viver nos cards de
      // "Hoje no Círcula" na Home (HomeExperienceStrip), além do chip do
      // desktop. Mesmo mecanismo de sempre, nenhum handler novo.
      inBottomNav: false,
    })
    navItems.push({
      key: 'eventos',
      label: 'Eventos',
      Icon: CalendarIcon,
      inBottomNav: false,
    })
    // Ajustes de navegação — "Receitas" ganha um card próprio em "Hoje
    // no Círcula" (reusa 100% a Biblioteca já existente: community_content
    // type='recipe', ContentLibrary/ContentManager). Mesma resolução de
    // comunidade de círculos/eventos/loja.
    navItems.push({
      key: 'receitas',
      label: 'Receitas',
      Icon: BookIcon,
      inBottomNav: false,
    })
    // Meu Jardim — desafios de atividades diárias. Mesma resolução de
    // comunidade de círculos/eventos/receitas (community-picker quando
    // houver mais de uma relevante).
    navItems.push({
      key: 'jardim',
      label: 'Meu Jardim',
      Icon: SproutIcon,
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

  // Fase 10 — resumo leve do trilho direito (próximo evento). Só busca
  // quando faz sentido: member ou professional, com comunidade, na Home.
  // useRailSummary(null,null) não faz fetch.
  const railActive =
    !!railCommunity && profile?.role !== 'master' && activeNav === 'inicio'
  const railSummary = useRailSummary(
    railActive ? railCommunity.id : null,
    railActive ? (profile?.id ?? null) : null,
  )

  // Círculos da comunidade resolvida — só busca quando o destino
  // "Círculos", "Eventos" ou "Receitas" está ativo (useCircles(null) não
  // faz fetch). Eventos/Receitas reaproveitam a mesma resolução de
  // comunidade dos círculos; Receitas usa `circles` só para o nome do
  // círculo de cada item (ContentLibrary).
  const circlesActive =
    effectiveNav === 'circulos' ||
    effectiveNav === 'eventos' ||
    effectiveNav === 'receitas'
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

  // Receitas — reusa 100% a Biblioteca (community_content type='recipe').
  // useContent(null) não faz fetch.
  const {
    items: contentItems,
    loading: contentLoading,
    error: contentError,
    toggleLike: toggleContentLike,
  } = useContent(effectiveNav === 'receitas' ? resolvedCirclesCommunityId : null)

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

  // Correção dos cards de Círculos — abrir um card da faixa "Círculos"
  // da Home vai direto à página DAQUELE círculo (CircleDetail), não à
  // lista genérica. `railCommunity` é a mesma comunidade em foco que a
  // HomeToday usa para montar essa faixa (idêntica resolução: a própria
  // para professional, a primeira em que participa para member) — por
  // isso serve para resolver o contexto de comunidade dos círculos sem
  // nenhuma consulta nova. Usa `onNavigate` (não `handleNavigate`): este
  // último zera `selectedCircleId` ao navegar para 'circulos', o que
  // desfaria a seleção que estamos fazendo aqui.
  function openCircleFromHome(circleId: string) {
    if (!railCommunity) return
    setCirclesCommunityId(railCommunity.id)
    setSelectedCircleId(circleId)
    onNavigate('circulos')
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
          onJoinCommunity={joinCommunity}
          onNavigate={handleNavigate}
          onOpenCircle={openCircleFromHome}
          coverHero={coverHero}
          railSummary={
            railActive
              ? {
                  nextEvent: railSummary.nextEvent,
                }
              : null
          }
        />
      )
    }

    if (effectiveNav === 'perfil') {
      return (
        <MyProfile
          profile={profile}
          onUpdate={onUpdateProfile}
          onUploadAvatar={onUploadAvatar}
          onUploadGalleryPhoto={onUploadGalleryPhoto}
        />
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

    // Ajustes de navegação — Receitas: reusa 100% a Biblioteca já
    // existente (community_content type='recipe'), só travando o filtro
    // de tipo (ContentLibrary lockType) e o rótulo da seção. Member vê
    // só publicado (RLS); Professional também cria/edita pela aba
    // Conteúdo do Painel (ContentManager já lista todos os tipos).
    if (effectiveNav === 'receitas') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            {renderCommunityPicker(
              'Receitas · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
          </>
        )
      }

      return (
        <ContentLibrary
          items={contentItems}
          loading={contentLoading}
          error={contentError}
          profileId={profile.id}
          circles={circles}
          canLike={profile.role !== 'master'}
          communityName={
            circlesRelevantCommunities.length > 1 ? circlesCommunity?.name : undefined
          }
          heading="Receitas"
          lockType="recipe"
          onToggleLike={(id, liked) => toggleContentLike(id, profile.id, liked)}
        />
      )
    }

    // Meu Jardim — Member participa, marca atividades concluídas e
    // compartilha no feed. Mesma resolução de comunidade de círculos/
    // eventos/receitas. Hook próprio (useGardenMember), autocontido
    // dentro de GardenMemberView — mesmo molde de CircleManager/
    // EventManager dentro do Painel.
    if (effectiveNav === 'jardim') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            {renderCommunityPicker(
              'Meu Jardim · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
          </>
        )
      }

      return (
        <GardenMemberView
          communityId={resolvedCirclesCommunityId}
          profileId={profile.id}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onShared={refreshFeed}
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
            // Reorganização do menu — Convite/Adição direta de membro
            // (antes no destino "Comunidades", removido) agora moram na
            // aba Participantes do Painel. Mesmos handlers de sempre
            // (useCommunity), só o local de montagem mudou.
            onInviteMember={(email, fullName) => inviteMember(community.id, email, fullName)}
            onAddMember={(email) => addMember(community.id, email)}
          />
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

    // member — "Comunidades" como destino próprio saiu (reorganização do
    // menu): o conteúdo é acessado pelo Feed. A descoberta de novas
    // comunidades (antes só alcançável por aqui) virou parte do fallback
    // "sem comunidade" de HomeToday.tsx, não um destino de nav.
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

  const isHomeFocus =
    !viewingProfileId && effectiveNav === 'inicio' && profile?.role !== 'master'

  // Capa da comunidade em foco: card contido (não mais hero full-bleed),
  // mostrado só quando há capa real; sem capa, HomeToday segue mostrando
  // o HomeCommunityHeader no formato sem foto, como antes.
  const coverHero = isHomeFocus && !!railCommunity?.cover_image_url

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        {/* Correção do logo (item 6) — ícone + "Círcula" formam a 1ª
            linha visual; "conectando mulheres" é a 2ª linha, alinhada
            ao conjunto (começa na mesma margem do ícone, não recuada
            só sob a palavra). Mesmo tratamento em mobile e desktop —
            o logo oficial em imagem (circula-logo.png), que antes
            substituía tudo isso no desktop, saiu: um único layout,
            responsivo por tamanho de fonte (ver App.css). */}
        <div className="brand">
          <div className="brand-row">
            <button
              type="button"
              className="brand-icon-btn"
              onClick={() => handleNavigate('inicio')}
              aria-label="Ir para o Início"
            >
              <img src={circulaIcon} alt="" className="brand-icon" />
            </button>
            <h1 className="brand-name">Círcula</h1>
          </div>
          {/* Pedido do usuário (revisão) — a tentativa anterior esticava o
              ESPAÇO ENTRE as palavras (flex justify-content:space-between
              sobre 2 <span>) para preencher a largura do conjunto
              ícone+"Círcula": lia como duas palavras artificialmente
              separadas, não uma frase natural. Removido — volta a ser um
              texto único, espaço entre palavras normal; é a tipografia
              (tamanho + letter-spacing, ver .brand-tagline em App.css),
              não o espaçamento entre palavras, que ajusta a largura. */}
          <p className="brand-tagline">conectando mulheres</p>
        </div>

        <div className="dashboard-user">
          {profile && profile.role !== 'master' && (
            <NotificationBell
              profileId={profile.id}
              onNavigate={handleNavigate}
              onOpenConversation={openConversationById}
              showBillingStatus={profile.role === 'professional'}
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

      {/* Redesign da Home, item 2 — a navegação sobe para logo abaixo do
          logotipo, ANTES do banner (a capa da comunidade, quando há).
          Troca de ordem só: grid-row de .topnav (2) e
          .dashboard-community-cover (3) acompanha essa mesma ordem no
          desktop (App.css); no mobile a ordem no DOM já basta. */}
      <PrimaryNav
        items={navItems}
        active={effectiveNav}
        onNavigate={handleNavigate}
        badges={{ mensagens: totalUnread }}
      />

      {coverHero && railCommunity && (
        <div className="dashboard-community-cover">
          <HomeCommunityHeader community={railCommunity} profileId={profile?.id} overlay />
        </div>
      )}

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
        <div className="dashboard-main">
          <div className="community-area">
            {loading && <p>Carregando comunidade...</p>}

            {!loading && error && <p className="auth-error">{error}</p>}

            {!loading && !error && (
              <Suspense fallback={<p>Carregando...</p>}>{renderDestination()}</Suspense>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
