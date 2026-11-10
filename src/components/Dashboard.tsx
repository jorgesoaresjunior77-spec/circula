import { Suspense, lazy, useEffect, useRef, useState } from 'react'
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
import { Onboarding } from './Onboarding'
import { Tour } from './Tour'
import { InstallAppGuide } from './InstallAppGuide'
import { isPastOnboarding, shouldAutoShowInstallGuide } from '../lib/installGuide'
import { useEvents } from '../hooks/useEvents'
import { useSavedItems } from '../hooks/useSavedItems'
import { NotificationBell } from './NotificationBell'
import { useConversations } from '../hooks/useConversations'
import { ProductManager } from './ProductManager'
import { HelpNutri } from './HelpNutri'
import { FeedNotices } from './FeedNotices'
import { RecipesPage } from './RecipesPage'
import { EventManager } from './EventManager'
import { CircleManager } from './CircleManager'
import { GardenPage } from './GardenPage'
import { AgendaPage } from './AgendaPage'
import { WaterPage } from './WaterPage'
import { ImcPage } from './ImcPage'
import { PlansPage } from './PlansPage'
import { PlaylistPage } from './PlaylistPage'
import { AntesDeTudoPage } from './AntesDeTudoPage'
import { ReadingTipsPage } from './ReadingTipsPage'
import { BreathingPage } from './BreathingPage'
import { InspirationManagerPage } from './InspirationManagerPage'
import { DailyInspiration } from './DailyInspiration'
import { GardenMonthManager } from './GardenMonthManager'
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
import { HomeGreeting } from './HomeGreeting'
import { HomeToolCards } from './HomeToolCards'
import { PrimaryNav } from './PrimaryNav'
import { useRailSummary } from '../hooks/useRailSummary'
import { useHomeBadges } from '../hooks/useHomeBadges'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import type { NavItem, NavKey } from './PrimaryNav'
import {
  BookIcon,
  CalendarIcon,
  CirclesIcon,
  DropIcon,
  HeartIcon,
  ChevronLeftIcon,
  SparkleIcon,
  FeedIcon,
  HomeIcon,
  MessageIcon,
  PanelIcon,
  SproutIcon,
  StoreIcon,
  UserIcon,
} from './icons'

// Destinos acessados sob demanda: saem do pacote inicial (abre mais rápido).
const Messages = lazy(() => import('./Messages').then((m) => ({ default: m.Messages })))
const EventList = lazy(() => import('./EventList').then((m) => ({ default: m.EventList })))
const SavedItems = lazy(() => import('./SavedItems').then((m) => ({ default: m.SavedItems })))
const CircleDetail = lazy(() => import('./CircleDetail').then((m) => ({ default: m.CircleDetail })))
const CircleRequestForm = lazy(() => import('./CircleRequestForm').then((m) => ({ default: m.CircleRequestForm })))

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
          <img loading="lazy" decoding="async" src={coverUrl} alt="" />
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
  onUploadBanner: (file: File) => Promise<{ error: string | null }>
  /** Perfil (item 10) — upload cru de uma foto da galeria (bucket
   *  `avatars`, mesmo de sempre); devolve a URL pública, não toca
   *  `profiles` — MyProfile persiste o array via onUpdateProfile. */
  onUploadGalleryPhoto: (file: File) => Promise<{ url: string | null; error: string | null }>
  activeNav: NavKey
  onNavigate: (key: NavKey) => void
}

// Telas internas abertas a partir de cards da Home: ganham botão "Voltar".
const INNER_SCREENS: NavKey[] = ['agenda', 'agua', 'imc', 'planos', 'playlist', 'antes-de-tudo', 'leitura', 'respiracao', 'inspiracoes']

export function Dashboard({
  profile,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
  onUploadBanner,
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
  // Etapa 5 (evolução/experiência/gamificação) — formulário de
  // solicitação de novo Círculo, mesmo padrão de `selectedCircleId`
  // (um flag de mais, já que os dois nunca ficam ativos ao mesmo tempo:
  // abrir um sempre fecha o outro — ver handleNavigate/handlers abaixo).
  const [showNewCircleForm, setShowNewCircleForm] = useState(false)
  // Etapa 9 (evolução/gamificação) — tour guiado: disparado pelo fim do
  // onboarding (Etapa 8) ou manualmente ("Rever o tour" no Perfil).
  const [showTour, setShowTour] = useState(false)
  // Guia "colocar o Círcula na tela do celular" (Android/iPhone): aparece
  // sozinho, uma vez por aparelho, ao fim do tour (ou ao pular o
  // onboarding), e pode ser reaberto pelo Perfil.
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  function offerInstallGuide() {
    if (shouldAutoShowInstallGuide()) setShowInstallGuide(true)
  }
  // Quem já terminou o onboarding antes desta sessão não passa pelo fim do
  // tour: oferece o guia uma vez, no primeiro carregamento do perfil.
  const installGuideChecked = useRef(false)
  useEffect(() => {
    if (installGuideChecked.current || !profile) return
    installGuideChecked.current = true
    if (isPastOnboarding(profile)) offerInstallGuide()
    // offerInstallGuide só lê storage/navegador; roda uma vez por carregamento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])
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
    // Agenda — aberta pelo calendário compacto da Home. Fora da cápsula
    // e dos cards: só se chega a ela pelo calendário.
    navItems.push({
      key: 'agenda',
      label: 'Agenda',
      Icon: CalendarIcon,
      inBottomNav: false,
    })
    // Dicas de Leitura e Respiração e Meditação — conteúdo da comunidade,
    // abertos pelos cards finos da Home. Mesma resolução de comunidade do
    // Meu Jardim.
    navItems.push({
      key: 'leitura',
      label: 'Leitura',
      Icon: BookIcon,
      inBottomNav: false,
    })
    navItems.push({
      key: 'respiracao',
      label: 'Respiração',
      Icon: HeartIcon,
      inBottomNav: false,
    })
    // Mensagens do dia (pop-up diário) — só a profissional cadastra.
    if (profile?.role === 'professional') {
      navItems.push({
        key: 'inspiracoes',
        label: 'Mensagens do dia',
        Icon: SparkleIcon,
        inBottomNav: false,
      })
    }
    // ANTES DE TUDO — ritual diário de hábitos, aberto pelo card fino da Home.
    navItems.push({
      key: 'antes-de-tudo',
      label: 'Antes de tudo',
      Icon: SparkleIcon,
      inBottomNav: false,
    })
    // Calculadora de água — aberta pelo card fino da Home.
    navItems.push({
      key: 'agua',
      label: 'Água',
      Icon: DropIcon,
      inBottomNav: false,
    })
    // Calculadora de IMC — aberta pelo card de ferramentas da Home.
    navItems.push({
      key: 'imc',
      label: 'IMC',
      Icon: HeartIcon,
      inBottomNav: false,
    })
    // Planos — aberto pelo card de assinaturas da Home. A profissional vê a
    // página como a membro vê (sem assinar: é a responsável e é isenta).
    if (profile?.role === 'member' || profile?.role === 'professional') {
      navItems.push({ key: 'planos', label: 'Planos', Icon: StoreIcon, inBottomNav: false })
    }
    // Playlist — aberta pelo menu vertical da Home (ainda sem conteúdo).
    navItems.push({ key: 'playlist', label: 'Playlist', Icon: HeartIcon, inBottomNav: false })
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

  const homeBadges = useHomeBadges(
    profile && profile.role !== 'master' ? (railCommunity?.id ?? null) : null,
    profile?.id ?? null,
    profile?.role === 'professional',
    effectiveNav,
  )
  useEffect(() => {
    if (effectiveNav === 'eventos') homeBadges.markEventsSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveNav])

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
    if (key === 'circulos') {
      setSelectedCircleId(null)
      setShowNewCircleForm(false)
    }
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
    setShowNewCircleForm(false)
    onNavigate('circulos')
  }

  // Etapa 5 — mesmo mecanismo de openCircleFromHome, só que abre o
  // formulário de solicitação em vez de um Círculo específico.
  function openNewCircleFormFromHome() {
    if (!railCommunity) return
    setCirclesCommunityId(railCommunity.id)
    setSelectedCircleId(null)
    setShowNewCircleForm(true)
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
          onRequestNewCircle={
            profile.role === 'member' ? openNewCircleFormFromHome : () => handleNavigate('circulos')
          }
          badges={{
            'help-nutri': totalUnread,
            eventos: homeBadges.newEvents,
            'novo-circulo': homeBadges.pendingCircleRequests,
            jardim: homeBadges.gardenPending ? 1 : 0,
          }}
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
          onUploadBanner={onUploadBanner}
          onUploadGalleryPhoto={onUploadGalleryPhoto}
          communityId={railCommunity?.id ?? null}
          onRestartTour={() => setShowTour(true)}
          onShowInstallGuide={() => setShowInstallGuide(true)}
        />
      )
    }

    if (effectiveNav === 'mensagens' && profile.role === 'member' && railCommunity) {
      return (
        <HelpNutri
          ownerId={railCommunity.owner_id}
          myProfileId={profile.id}
          conversations={conversations}
          initialConversationId={pendingConversationId}
          onConsumedInitial={() => setPendingConversationId(null)}
          onStartConversation={startConversation}
          onActivity={refreshConversations}
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
          <FeedNotices
            communityId={feedCommunity.id}
            gardenPending={homeBadges.gardenPending}
            onOpenGarden={() => handleNavigate('jardim')}
          />
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

      if (showNewCircleForm) {
        return (
          <CircleRequestForm
            communityId={resolvedCirclesCommunityId}
            profileId={profile.id}
            onBack={() => setShowNewCircleForm(false)}
          />
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

      const circleList = (
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
      if (profile.role !== 'professional') return circleList
      return (
        <>
          {circleList}
          <CircleManager communityId={resolvedCirclesCommunityId} profileId={profile.id} canManage canParticipate />
        </>
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

      const eventList = (
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
      if (profile.role !== 'professional') return eventList
      return (
        <>
          {eventList}
          <EventManager communityId={resolvedCirclesCommunityId} profileId={profile.id} canManage />
        </>
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
        <RecipesPage
          communityId={resolvedCirclesCommunityId}
          profileId={profile.id}
          isOwner={profile.role === 'professional'}
        />
      )
    }

    // ANTES DE TUDO — dado pessoal, não depende de comunidade em foco.
    if (effectiveNav === 'antes-de-tudo') {
      return <AntesDeTudoPage profileId={profile.id} onNavigate={handleNavigate} />
    }

    // Calculadora de água — dado pessoal, não depende de comunidade em foco.
    if (effectiveNav === 'agua') {
      return <WaterPage profileId={profile.id} />
    }

    if (effectiveNav === 'imc') {
      return (
        <ImcPage
          onTalkToNutri={profile.role === 'member' ? () => handleNavigate('mensagens') : undefined}
        />
      )
    }

    if (effectiveNav === 'playlist') {
      return <PlaylistPage />
    }

    if (effectiveNav === 'planos') {
      return <PlansPage communityId={myCommunities[0]?.id ?? null} viewOnly={profile.role === 'professional'} />
    }

    // Dicas de Leitura / Respiração e Meditação — conteúdo cadastrado pela
    // profissional da comunidade; membro vê só o publicado (RLS).
    if (effectiveNav === 'leitura' || effectiveNav === 'respiracao') {
      if (circlesRelevantCommunities.length === 0) {
        return <p>Você ainda não faz parte de nenhuma comunidade.</p>
      }

      if (!resolvedCirclesCommunityId) {
        return (
          <>
            {renderCommunityPicker(
              effectiveNav === 'leitura'
                ? 'Dicas de Leitura · escolha uma comunidade'
                : 'Respiração e Meditação · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
          </>
        )
      }

      return effectiveNav === 'leitura' ? (
        <ReadingTipsPage
          communityId={resolvedCirclesCommunityId}
          profileId={profile.id}
          isOwner={profile.role === 'professional'}
        />
      ) : (
        <BreathingPage
          communityId={resolvedCirclesCommunityId}
          isOwner={profile.role === 'professional'}
        />
      )
    }

    // Mensagens do dia — cadastro das citações/textos do pop-up diário.
    if (effectiveNav === 'inspiracoes' && profile.role === 'professional') {
      if (!resolvedCirclesCommunityId) {
        return (
          <>
            {renderCommunityPicker(
              'Mensagens do dia · escolha uma comunidade',
              circlesRelevantCommunities,
              setCirclesCommunityId,
            )}
          </>
        )
      }
      return <InspirationManagerPage communityId={resolvedCirclesCommunityId} />
    }

    // Agenda do membro — não depende de comunidade em foco.
    if (effectiveNav === 'agenda') {
      return <AgendaPage profileId={profile.id} />
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
        <>
          <GardenPage
            communityId={resolvedCirclesCommunityId}
            profileId={profile.id}
            onOpenAgenda={() => handleNavigate('agenda')}
            isOwner={profile.role === 'professional'}
            onChecked={homeBadges.reload}
          />
          {profile.role === 'professional' && (
            <GardenMonthManager communityId={resolvedCirclesCommunityId} profileId={profile.id} />
          )}
        </>
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
            onNavigate={handleNavigate}
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
              <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" />
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
          <HomeGreeting fullName={profile?.full_name} />
          {/* Banner + atalhos na vertical, ocupando exatamente a altura dele. */}
          <div className="dashboard-cover-row">
            <HomeCommunityHeader community={railCommunity} profileId={profile?.id} overlay />
            <HomeToolCards vertical onNavigate={handleNavigate} />
          </div>
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
              <>
                {INNER_SCREENS.includes(effectiveNav) && (
                  <button type="button" className="back-button" onClick={() => handleNavigate('inicio')}>
                    <ChevronLeftIcon size={18} /> Voltar
                  </button>
                )}
                <Suspense fallback={<p>Carregando...</p>}>{renderDestination()}</Suspense>
              </>
            )}
          </div>
        </div>
      )}

      {/* Etapa 8 (evolução/gamificação) — onboarding de boas-vindas, só
          para Member (quem de fato ingressa numa comunidade) e só
          quando `onboarding_completed_at` é EXPLICITAMENTE `null` —
          nunca quando `undefined` (migration preparada, ainda não
          aplicada; ver nota em types/profile.ts e useAuth.refreshProfile). */}
      {profile && profile.role === 'member' && profile.onboarding_completed_at === null && (
        <Onboarding
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onDone={(completed) => {
            if (!completed) offerInstallGuide()
          }}
          onStartTour={() => setShowTour(true)}
        />
      )}

      {/* Etapa 9 — tour guiado, disparado ao concluir o onboarding
          (onStartTour acima) ou manualmente ("Rever o tour" no Perfil,
          ver handleRestartTour). */}
      {showTour && (
        <Tour
          onNavigate={handleNavigate}
          onDone={() => {
            setShowTour(false)
            offerInstallGuide()
            if (profile?.tour_completed_at === undefined) return // migration ainda não aplicada
            void onUpdateProfile({ tour_completed_at: new Date().toISOString() })
          }}
        />
      )}

      {showInstallGuide && <InstallAppGuide onClose={() => setShowInstallGuide(false)} />}

      {/* Pop-up diário de inspiração — uma vez por dia por pessoa; espera
          o onboarding, o tour e o guia de instalação terminarem. */}
      {profile && profile.role !== 'master' && (
        <DailyInspiration
          communityId={railCommunity?.id ?? null}
          profileId={profile.id}
          onManage={profile.role === 'professional' ? () => handleNavigate('inspiracoes') : undefined}
          suppressed={
            showTour ||
            showInstallGuide ||
            (profile.role === 'member' && profile.onboarding_completed_at === null)
          }
        />
      )}
    </section>
  )
}
