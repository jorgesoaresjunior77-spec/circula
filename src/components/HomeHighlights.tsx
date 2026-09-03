import { useMemo } from 'react'
import type { NavKey } from './PrimaryNav'
import type { Post } from '../types/post'
import type { CircleWithMembers } from '../types/circle'
import type { usePosts } from '../hooks/usePosts'
import { useEvents } from '../hooks/useEvents'
import { useContent } from '../hooks/useContent'
import { useCheckins } from '../hooks/useCheckins'
import { isPastEvent } from '../lib/formatEventDate'
import { PostCard } from './PostCard'
import { EventCard } from './EventCard'
import { ContentCard } from './ContentCard'
import { RecipeCard } from './RecipeCard'
import { CheckinResponseForm } from './CheckinResponseForm'

// MÓDULO 6 · A4 — HomeToday v2 (Home rica)
//
// Blocos novos da Home, todos alimentados por hooks que já existem
// (usePosts / useEvents / useContent / useCheckins) e renderizados com
// os cards que já existem (PostCard / EventCard / ContentCard /
// CheckinResponseForm). Nenhuma consulta agregadora, nenhuma RPC nova,
// nenhuma migration. Sem IA, sem placeholder: um bloco só aparece se
// houver dado real; se a fonte falhar, o hook devolve lista vazia e o
// bloco some — a tela não quebra. Este componente só é montado quando a
// HomeToday já tem uma comunidade em foco (communityId garantido).

const RECENT_POSTS_LIMIT = 4
const UPCOMING_EVENTS_LIMIT = 3
const LIBRARY_LIMIT = 3
const CONTENT_LIMIT = 3

interface HomeHighlightsProps {
  communityId: string
  profileId: string
  /** Círculos da comunidade em foco (já carregados na HomeToday). */
  circles: CircleWithMembers[]
  /**
   * Instância ÚNICA de usePosts, criada na HomeToday e compartilhada com
   * o "Resumo do dia" (useHomeToday). NÃO instanciar outra aqui — evita
   * segunda fonte de verdade e a consulta duplicada do feed da comunidade.
   */
  postsApi: ReturnType<typeof usePosts>
  onNavigate: (key: NavKey) => void
}

export function HomeHighlights({
  communityId,
  profileId,
  circles,
  postsApi,
  onNavigate,
}: HomeHighlightsProps) {
  const events = useEvents(communityId)
  const content = useContent(communityId)
  const checkins = useCheckins(communityId)

  const circleNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const circle of circles) map.set(circle.id, circle.name)
    return map
  }, [circles])

  // posts já vêm ordenados por created_at desc e restritos ao feed da
  // comunidade (circle_id nulo) — o mais recente de cada tipo é o find.
  const dailyQuestion =
    postsApi.posts.find((p) => p.post_type === 'daily_question') ?? null
  const dailyCommand =
    postsApi.posts.find((p) => p.post_type === 'engagement_command') ?? null

  const shownPostIds = new Set(
    [dailyQuestion?.id, dailyCommand?.id].filter((id): id is string => Boolean(id)),
  )
  const recentPosts = postsApi.posts
    .filter((p) => !shownPostIds.has(p.id))
    .slice(0, RECENT_POSTS_LIMIT)

  const upcomingEvents = events.events
    .filter((e) => e.status !== 'draft' && !isPastEvent(e.starts_at, e.ends_at))
    .slice()
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, UPCOMING_EVENTS_LIMIT)

  // Fase 1 — "Biblioteca" deixa de ser conceito principal: a Home
  // destaca Receitas. Os demais tipos de conteúdo seguem geridos no
  // painel da Nutri; a área dedicada de Receitas chega na Fase 2.
  const libraryHighlights = content.items
    .filter((item) => item.status === 'published' && item.type === 'recipe')
    .slice(0, LIBRARY_LIMIT)

  // Fase 10 — "Conteúdo para você": os tipos NÃO-receita publicados
  // (artigo, dica, material, vídeo, educativo). A Biblioteca antiga não
  // volta — é só uma faixa da Home, e só aparece se houver conteúdo real.
  const contentForYou = content.items
    .filter((item) => item.status === 'published' && item.type !== 'recipe')
    .slice(0, CONTENT_LIMIT)

  const pendingCheckin =
    checkins.instances.find((instance) => {
      const responses = checkins.responsesByInstance[instance.id] ?? []
      return !responses.some((r) => r.profile_id === profileId)
    }) ?? null

  const postCardProps = (post: Post) => ({
    post,
    reactionCount: postsApi.reactionCounts[post.id] ?? 0,
    hasReacted: postsApi.reactedPostIds.has(post.id),
    commentCount: postsApi.commentCounts[post.id] ?? 0,
    comments: postsApi.commentsByPost[post.id],
    canInteract: true,
    onToggleReaction: () => postsApi.toggleReaction(post.id, profileId),
    onOpenComments: () => postsApi.fetchComments(post.id),
    onAddComment: (text: string) => postsApi.addComment(post.id, profileId, text),
  })

  const hasAnything =
    dailyQuestion ||
    dailyCommand ||
    pendingCheckin ||
    upcomingEvents.length > 0 ||
    libraryHighlights.length > 0 ||
    contentForYou.length > 0 ||
    recentPosts.length > 0

  if (!hasAnything) return null

  return (
    <>
      {dailyQuestion && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Pergunta do dia</h3>
          </div>
          <PostCard {...postCardProps(dailyQuestion)} />
        </section>
      )}

      {dailyCommand && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Comando da comunidade</h3>
          </div>
          <PostCard {...postCardProps(dailyCommand)} />
        </section>
      )}

      {pendingCheckin && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Check-in de hoje</h3>
          </div>
          <div className="checkin-block">
            <p className="checkin-prompt">{pendingCheckin.content}</p>
            <CheckinResponseForm
              myResponse={undefined}
              onRespond={(mood, wantsToShare) =>
                checkins.respondCheckin(pendingCheckin.id, profileId, mood, wantsToShare)
              }
              onShare={async (text) => {
                const result = await checkins.shareCheckin(profileId, text)
                if (!result.error) postsApi.refresh()
                return result
              }}
            />
          </div>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Próximos eventos</h3>
            <button
              type="button"
              className="home-section-link"
              onClick={() => onNavigate('eventos')}
            >
              Ver todos
            </button>
          </div>
          <div className="home-card-stack">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                profileId={profileId}
                circleName={
                  event.circle_id ? (circleNameById.get(event.circle_id) ?? null) : null
                }
                canRsvp
                onRsvp={() => events.rsvp(event.id, profileId)}
                onCancelRsvp={() => events.cancelRsvp(event.id, profileId)}
              />
            ))}
          </div>
        </section>
      )}

      {libraryHighlights.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Receitas</h3>
            <button
              type="button"
              className="home-section-link"
              onClick={() => onNavigate('receitas')}
            >
              Ver todas
            </button>
          </div>
          <div className="home-recipe-row">
            {libraryHighlights.map((item) => (
              <RecipeCard key={item.id} recipe={item} onOpen={() => onNavigate('receitas')} />
            ))}
          </div>
        </section>
      )}

      {contentForYou.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Conteúdo para você</h3>
          </div>
          <div className="home-card-stack">
            {contentForYou.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                profileId={profileId}
                circleName={
                  item.circle_id ? (circleNameById.get(item.circle_id) ?? null) : null
                }
                canLike
                onToggleLike={(liked) => content.toggleLike(item.id, profileId, liked)}
              />
            ))}
          </div>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h3 className="home-section-title">Publicações recentes</h3>
            <button
              type="button"
              className="home-section-link"
              onClick={() => onNavigate('feed')}
            >
              Ver todas
            </button>
          </div>
          <div className="home-card-stack">
            {recentPosts.map((post) => (
              <PostCard key={post.id} {...postCardProps(post)} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
