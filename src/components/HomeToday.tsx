import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Profile } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import type { HomeActivityItem } from '../types/home'
import type { NavKey } from './PrimaryNav'
import { useCircles } from '../hooks/useCircles'
import { useChallenges } from '../hooks/useChallenges'
import { usePosts } from '../hooks/usePosts'
import { useHomeToday } from '../hooks/useHomeToday'
import { CreateCommunityForm } from './CreateCommunityForm'
import { ChallengeCard } from './ChallengeCard'
import { CircleCard } from './CircleCard'
import { DailyMoodCard } from './DailyMoodCard'
import { JoyMomentsSection } from './JoyMomentsSection'
import { HelpRequestSection } from './HelpRequestSection'
import { HomeHighlights } from './HomeHighlights'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { PointsWidget } from './PointsWidget'
import { AchievementsStrip } from './AchievementsStrip'
import { EmptyState } from './EmptyState'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { CommentIcon, HeartIcon, CirclesIcon, CommunitiesIcon, SproutIcon } from './icons'

// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
//
// Dashboard pessoal do destino "Início" para member e professional.
// master NÃO chega aqui (o Dashboard exige role !== 'master').
// Composição visual guiada pelas referências em
// identidadevisual/ExemplosPainel/ (phone 1 da imagem 1 e painel
// central da imagem 2). Lógica e dados inalterados: mesmos hooks
// (useCircles / useChallenges / useHomeToday), mesmas condições, mesmo
// ChallengeCard reutilizado. Não toca no Feed, comunidades, círculos,
// produtos, checkout ou billing.

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
  /** Abrir uma conversa do Mensagens (deep-link do Pedido de ajuda "para a Nutri"). */
  onOpenConversation: (conversationId: string) => void
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
  onOpenConversation,
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

  const { circles, loading: circlesLoading, joinCircle, leaveCircle } = useCircles(communityId)

  // A5-cleanup (opção A): instância ÚNICA de usePosts na Home. Alimenta
  // os blocos ricos (HomeHighlights) E o "Resumo do dia" / "Atividade
  // recente" (useHomeToday recebe postsApi.posts e deixa de fazer as
  // consultas #1 = ids das minhas publicações e #2 = publicações novas
  // 24h). Feed.tsx tem a própria instância e não é afetado — HomeToday e
  // Feed nunca montam ao mesmo tempo.
  const postsApi = usePosts(communityId, profile.id)

  const challenges = useChallenges(communityId, profile.id)

  const myCircles = useMemo(
    () => circles.filter((circle) => circle.members.some((m) => m.profile_id === profile.id)),
    [circles, profile.id],
  )

  // E2 — Círculos sugeridos: círculos da comunidade em foco onde a
  // usuária ainda NÃO participa. Ordena por mais participantes e, no
  // empate, pelo mais recente. Sem query nova: mesma instância de
  // useCircles (já restrita à comunidade e à RLS). Entrar = mesmo
  // joinCircle já usado no resto do app; ao entrar, o círculo sai
  // daqui e passa para "Seus círculos" no próximo fetch.
  const suggestedCircles = useMemo(
    () =>
      circles
        .filter((circle) => !circle.members.some((m) => m.profile_id === profile.id))
        .slice()
        .sort((a, b) => {
          const byMembers = b.members.length - a.members.length
          if (byMembers !== 0) return byMembers
          return b.created_at.localeCompare(a.created_at)
        })
        .slice(0, 4),
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
        {greetingName ? `, ${greetingName}` : ''} <span aria-hidden="true">🌸</span>
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

  // --- Resumo do dia: só tiles com dado real ------------------------
  const tiles: {
    key: string
    value: number
    label: string
    icon: ReactNode
    onClick: () => void
  }[] = []
  if (summary.repliesToMe > 0) {
    tiles.push({
      key: 'replies',
      value: summary.repliesToMe,
      label: summary.repliesToMe === 1 ? 'resposta para você' : 'respostas para você',
      icon: <CommentIcon size={16} />,
      onClick: () => onNavigate('comunidades'),
    })
  }
  if (summary.reactionsToMe > 0) {
    tiles.push({
      key: 'reactions',
      value: summary.reactionsToMe,
      label: summary.reactionsToMe === 1 ? 'nova interação' : 'novas interações',
      icon: <HeartIcon size={16} />,
      onClick: () => onNavigate('comunidades'),
    })
  }
  if (summary.newPosts > 0) {
    tiles.push({
      key: 'newPosts',
      value: summary.newPosts,
      label: summary.newPosts === 1 ? 'nova publicação' : 'novas publicações',
      icon: <SproutIcon size={16} />,
      onClick: () => onNavigate('comunidades'),
    })
  }
  if (summary.newMembers != null && summary.newMembers > 0) {
    tiles.push({
      key: 'newMembers',
      value: summary.newMembers,
      label: summary.newMembers === 1 ? 'nova participante' : 'novas participantes',
      icon: <CommunitiesIcon size={16} />,
      onClick: () => onNavigate('painel'),
    })
  }

  // --- Desafio em foco -------------------------------------------
  const activeChallenges = challenges.challenges.filter(
    (challenge) => challenge.is_active && challenge.activities.length > 0,
  )
  const pickedChallenge =
    activeChallenges.find((challenge) => challenges.myParticipation.has(challenge.id)) ??
    activeChallenges[0] ??
    null

  // --- Atalhos: só destinos que já existem para o papel ----------
  const shortcuts: { key: NavKey; label: string }[] = [
    { key: 'comunidades', label: 'Minha comunidade' },
    { key: 'circulos', label: 'Círculos' },
    ...(profile.role === 'professional'
      ? ([
          { key: 'painel', label: 'Painel' },
          { key: 'loja', label: 'Loja' },
        ] as { key: NavKey; label: string }[])
      : []),
    { key: 'perfil', label: 'Meu perfil' },
  ]

  return (
    <div className="home">
      {greeting}

      {/* Fase 10 — cabeçalho da comunidade: capa, logo, nome, profissional
          responsável e nº de participantes. "Onde estou" claro logo na
          entrada. Somente leitura. */}
      <HomeCommunityHeader
        community={focusCommunity}
        memberCount={memberCounts[focusCommunity.id]}
      />

      {/* Fase 3 — "Como você está hoje?": humor diário privado da usuária.
          Fase 10: emojis interativos. */}
      <DailyMoodCard profileId={profile.id} communityId={focusCommunity.id} />

      {/* Fase 4 — "Momento de alegria": tabela própria joy_moments, não o
          Feed. Fase 10: sobe antes do pedido de ajuda, para a Home abrir
          com leveza e positividade. */}
      <JoyMomentsSection profileId={profile.id} communityId={focusCommunity.id} />

      {/* Fase 5 — "Pedido de ajuda": estrutura própria (help_requests),
          sem virar post. Fase 10: copy acolhedora. */}
      <HelpRequestSection
        communityId={focusCommunity.id}
        communityOwnerId={focusCommunity.owner_id}
        profileId={profile.id}
        onOpenConversation={onOpenConversation}
      />

      <section className="home-summary-card">
        {homeLoading && tiles.length === 0 ? (
          <p className="home-muted">Carregando resumo...</p>
        ) : tiles.length > 0 ? (
          <div className="home-summary-grid">
            {tiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                className="home-stat"
                onClick={tile.onClick}
              >
                <span className="home-stat-icon" aria-hidden="true">
                  {tile.icon}
                </span>
                <span className="home-stat-value">{tile.value}</span>
                <span className="home-stat-label">{tile.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="home-muted">Tudo em dia por aqui 🌿</p>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h3 className="home-section-title">Seu desafio</h3>
        </div>
        {pickedChallenge ? (
          <div className="challenge-block">
            <ChallengeCard
              challenge={pickedChallenge}
              currentDay={challenges.currentDays[pickedChallenge.id] ?? 1}
              participantCount={challenges.participantCounts[pickedChallenge.id] ?? 0}
              todayCompletedCount={challenges.todayCompletedCounts[pickedChallenge.id] ?? 0}
              isParticipating={challenges.myParticipation.has(pickedChallenge.id)}
              isCompleted={challenges.myCompletions.has(pickedChallenge.id)}
              canParticipate
              profileId={profile.id}
              commentCount={challenges.commentCounts[pickedChallenge.id] ?? 0}
              comments={challenges.commentsByChallenge[pickedChallenge.id]}
              onJoin={() => challenges.joinChallenge(pickedChallenge.id, profile.id)}
              onProgressChange={() => challenges.refreshCounts(pickedChallenge.id)}
              onCompletionChange={() => challenges.refreshCompletions(pickedChallenge.id)}
              onOpenComments={() => challenges.fetchComments(pickedChallenge.id)}
              onAddComment={(content) =>
                challenges.addComment(pickedChallenge.id, profile.id, content)
              }
            />
          </div>
        ) : challenges.loading ? (
          <p className="home-muted">Carregando desafio...</p>
        ) : (
          <EmptyState message="Nenhum desafio ativo agora." />
        )}
      </section>

      {/* Fase 7 — pontos da usuária NESTA comunidade (nunca misturados
          entre comunidades). */}
      <PointsWidget
        communityId={focusCommunity.id}
        communityName={focusCommunity.name}
        profileId={profile.id}
      />

      {/* Fase 10 — Conquistas: selos derivados de pontos/desafios/dias/
          tempo de comunidade. Some se não houver nada. */}
      <AchievementsStrip communityId={focusCommunity.id} profileId={profile.id} />

      {/* A4 — blocos ricos: pergunta/comando do dia, check-in pendente,
          próximos eventos, destaques da biblioteca, publicações recentes.
          Cada um só aparece com dado real; tolerância a erro por bloco. */}
      <HomeHighlights
        communityId={focusCommunity.id}
        profileId={profile.id}
        circles={circles}
        postsApi={postsApi}
        onNavigate={onNavigate}
      />

      <section className="home-section">
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

      <section className="home-section">
        <div className="home-section-head">
          <h3 className="home-section-title">Seus círculos</h3>
          <button
            type="button"
            className="home-section-link"
            onClick={() => onNavigate('circulos')}
          >
            Ver todos
          </button>
        </div>
        {circlesLoading ? (
          <p className="home-muted">Carregando círculos...</p>
        ) : myCircles.length > 0 ? (
          <div className="home-circle-row">
            {myCircles.slice(0, 6).map((circle) => (
              <button
                key={circle.id}
                type="button"
                className="home-circle-tile"
                onClick={() => onNavigate('circulos')}
              >
                <span className="home-circle-cover" aria-hidden="true">
                  {circle.cover_image_url ? (
                    <img src={circle.cover_image_url} alt="" />
                  ) : (
                    <span className="home-circle-cover-fallback">
                      {circle.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="home-circle-name">{circle.name}</span>
                <span className="home-circle-meta">
                  {circle.members.length === 1
                    ? '1 mulher'
                    : `${circle.members.length} mulheres`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="home-muted">Você ainda não participa de círculos.</p>
        )}
      </section>

      {/* E2 — Círculos sugeridos: só aparece se houver ao menos um
          círculo da comunidade em que a usuária ainda não está. */}
      {suggestedCircles.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Círculos sugeridos</h3>
            <button
              type="button"
              className="home-section-link"
              onClick={() => onNavigate('circulos')}
            >
              Ver todos
            </button>
          </div>
          <div className="home-card-stack">
            {suggestedCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                isParticipating={false}
                canParticipate
                onJoin={() => joinCircle(circle.id, profile.id)}
                onLeave={() => leaveCircle(circle.id, profile.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="home-section home-shortcuts-section">
        <div className="home-shortcuts">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              className="home-chip"
              onClick={() => onNavigate(shortcut.key)}
            >
              {shortcut.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
