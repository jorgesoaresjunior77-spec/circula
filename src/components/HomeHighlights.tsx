import type { NavKey } from './PrimaryNav'
import type { Post } from '../types/post'
import type { usePosts } from '../hooks/usePosts'
import { PostCard } from './PostCard'

// D1 — "Destaques de hoje" (pergunta do dia / comando da comunidade /
// check-in / próximos eventos / conteúdo para você) saiu da Home por
// completo. "Publicações recentes" é a única seção que sobrou daqui —
// mantida a pedido explícito do usuário, só com a composição do
// PostCard mudada (mediaAside: foto inteira ao lado do texto no
// desktop). useEvents/useContent/useCheckins NÃO são mais chamados
// aqui (eram só para os blocos removidos) — os hooks continuam
// existindo para quem ainda precisa deles, só não são buscados à toa
// na Home.

const RECENT_POSTS_LIMIT = 4

interface HomeHighlightsProps {
  profileId: string
  /**
   * Instância ÚNICA de usePosts, criada na HomeToday e compartilhada com
   * o restante da Home. NÃO instanciar outra aqui.
   */
  postsApi: ReturnType<typeof usePosts>
  onNavigate: (key: NavKey) => void
}

export function HomeHighlights({ profileId, postsApi, onNavigate }: HomeHighlightsProps) {
  // posts já vêm ordenados por created_at desc e restritos ao feed da
  // comunidade (circle_id nulo).
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

  if (recentPosts.length === 0) return null

  return (
    <section className="home-section home-highlight-section">
      <div className="home-section-head">
        <h3 className="home-section-title">Publicações recentes</h3>
        <button type="button" className="home-section-link" onClick={() => onNavigate('feed')}>
          Ver todas
        </button>
      </div>
      <div className="home-card-stack">
        {recentPosts.map((post) => (
          <PostCard key={post.id} {...postCardProps(post)} mediaAside />
        ))}
      </div>
    </section>
  )
}
