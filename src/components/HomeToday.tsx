import { useMemo } from 'react'
import type { Profile } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import type { HomeActivityItem } from '../types/home'
import type { NavKey } from './PrimaryNav'
import { useCircles } from '../hooks/useCircles'
import { usePosts } from '../hooks/usePosts'
import { useContent } from '../hooks/useContent'
import { useHomeToday } from '../hooks/useHomeToday'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { filterInstagramContent } from '../lib/instagramContent'
import { CreateCommunityForm } from './CreateCommunityForm'
import { HomeHighlights } from './HomeHighlights'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { HomeExperienceStrip } from './HomeExperienceStrip'
import { HomeCirclesSection } from './HomeCirclesSection'
import { EmptyState } from './EmptyState'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { CommentIcon, HeartIcon, CirclesIcon } from './icons'

// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
//
// Dashboard pessoal do destino "Início" para member e professional.
// master NÃO chega aqui (o Dashboard exige role !== 'master').
// Composição visual guiada pelas referências em
// identidadevisual/ExemplosPainel/ (phone 1 da imagem 1 e painel
// central da imagem 2). Lógica e dados inalterados: mesmos hooks
// (useCircles / useHomeToday), mesmas condições. Não toca no Feed,
// comunidades, círculos, produtos, checkout ou billing.

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

function activityText(item: HomeActivityItem): string {
  const who = item.actorName ?? 'Alguém'
  switch (item.kind) {
    case 'comment':
      return `${who} comentou na sua publicação`
    case 'reaction':
      return `${who} reagiu à sua publicação`
    case 'reaction_group':
      return `${item.count} pessoas reagiram às suas publicações`
    case 'new_posts':
      return item.count === 1
        ? '1 nova publicação na comunidade'
        : `${item.count} novas publicações na comunidade`
    case 'circle_join':
      return `${who} entrou no círculo ${item.circleName ?? ''}`.trim()
    default:
      return ''
  }
}

export function HomeToday({
  profile,
  communities,
  discoverableCommunities,
  memberCounts,
  onCreateCommunity,
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

  // A5-cleanup (opção A): instância ÚNICA de usePosts na Home. Alimenta
  // os blocos ricos (HomeHighlights) E o "Resumo do dia" / "Atividade
  // recente" (useHomeToday recebe postsApi.posts e deixa de fazer as
  // consultas #1 = ids das minhas publicações e #2 = publicações novas
  // 24h). Feed.tsx tem a própria instância e não é afetado — HomeToday e
  // Feed nunca montam ao mesmo tempo.
  const postsApi = usePosts(communityId, profile.id)

  // C4.1 — "No Instagram": publicações que a comunidade cadastrou como
  // community_content com link do Instagram + capa. useContent já existe
  // (não é hook novo); a HomeExperienceStrip recebe a lista filtrada e
  // só mostra o card quando há publicação real.
  const { items: contentItems } = useContent(communityId)
  const instagramPosts = useMemo(
    () => filterInstagramContent(contentItems),
    [contentItems],
  )

  // Imagens (só VISUAIS) que a Profissional cadastrou no Painel para as
  // capas dos 6 cards de experiência. Sem imagem cadastrada -> o card
  // mantém o fallback editorial atual. Não muda a origem dos dados.
  const { images: cardImagePaths } = useCommunityCardImages(communityId)
  const { url: cardCoverHoje } = useSignedImageUrl(cardImagePaths.hoje ?? null)
  const { url: cardCoverEventos } = useSignedImageUrl(cardImagePaths.eventos ?? null)
  const { url: cardCoverComunidade } = useSignedImageUrl(
    cardImagePaths.comunidade ?? null,
  )
  const { url: cardCoverInstagram } = useSignedImageUrl(
    cardImagePaths.instagram ?? null,
  )
  const cardCovers = useMemo(
    () => ({
      hoje: cardCoverHoje,
      eventos: cardCoverEventos,
      comunidade: cardCoverComunidade,
      instagram: cardCoverInstagram,
    }),
    [cardCoverHoje, cardCoverEventos, cardCoverComunidade, cardCoverInstagram],
  )

  const myCircles = useMemo(
    () => circles.filter((circle) => circle.members.some((m) => m.profile_id === profile.id)),
    [circles, profile.id],
  )

  const {
    summary,
    recentActivity,
    loading: homeTodayLoading,
  } = useHomeToday(profile, communityId, myCircles, postsApi.posts)

  const homeLoading = homeTodayLoading || postsApi.loading

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
    return (
      <div className="home">
        {greeting}
        <section className="community-card">
          <p>Você ainda não faz parte de nenhuma comunidade.</p>
          {discoverableCommunities.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('comunidades')}
            >
              Descobrir comunidades
            </button>
          )}
        </section>
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

      {/* C2 — Faixa editorial de experiências da comunidade, logo abaixo
          do hero. Só dados reais que a Home já tem; cada card leva à ação
          que já existe (rota existente, rolar até a seção detalhada ou,
          em "No Instagram", abrir a tela editorial no app — C4.1). */}
      <HomeExperienceStrip
        summary={summary}
        nextEvent={railSummary?.nextEvent ?? null}
        newPosts={summary.newPosts}
        hasPosts={postsApi.posts.length > 0}
        instagramPosts={instagramPosts}
        cardCovers={cardCovers}
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

      {/* D1 — "Destaques de hoje" (pergunta/comando/check-in/eventos/
          conteúdo) saiu da Home. Só "Publicações recentes" continua. */}
      <HomeHighlights profileId={profile.id} postsApi={postsApi} onNavigate={onNavigate} />

      <section className="home-section home-activity-section">
        <div className="home-section-head">
          <h3 className="home-section-title">Atividade recente</h3>
        </div>
        {homeLoading && recentActivity.length === 0 ? (
          <p className="home-muted">Carregando atividade...</p>
        ) : recentActivity.length > 0 ? (
          <ul className="home-activity">
            {recentActivity.map((item) => (
              <li key={item.id} className="home-activity-item">
                <span className="home-activity-avatar" aria-hidden="true">
                  {item.actorAvatarUrl ? (
                    <img src={item.actorAvatarUrl} alt="" />
                  ) : item.actorName ? (
                    <span>{item.actorName.charAt(0).toUpperCase()}</span>
                  ) : item.kind === 'circle_join' ? (
                    <CirclesIcon size={16} />
                  ) : item.kind === 'comment' ? (
                    <CommentIcon size={16} />
                  ) : (
                    <HeartIcon size={16} />
                  )}
                </span>
                <span className="home-activity-text">{activityText(item)}</span>
                <span className="home-activity-time">{formatRelativeTime(item.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Sem novidades por enquanto." />
        )}
      </section>

      {/* C3 — "Seus círculos" e "Círculos sugeridos" foram consolidados
          na coleção editorial <HomeCirclesSection> logo abaixo do hero.
          O destino "Círculos" (CircleList / CircleDetail com filtros e
          entrada/saída) permanece intacto na navegação. D4 — "Ir
          rápido" foi removido da Home (os mesmos destinos já estão no
          menu principal). */}

      <p className="home-institutional-note">
        O Círcula é um espaço de cuidado e amizade entre mulheres.
      </p>
    </div>
  )
}
