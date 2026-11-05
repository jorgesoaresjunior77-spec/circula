import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Feed } from './Feed'
import { usePosts } from '../hooks/usePosts'
import type { Post } from '../types/post'

vi.mock('../hooks/usePosts')
vi.mock('../hooks/useSavedPostIds', () => ({
  useSavedPostIds: () => ({ savedPostIds: new Set<string>(), toggleSavedPost: vi.fn() }),
}))
vi.mock('./PostComposer', () => ({ PostComposer: () => <div data-testid="composer" /> }))
// Cada card vira uma linha simples: o que interessa aqui é QUANTAS mensagens abrem.
vi.mock('./PostCard', () => ({
  PostCard: ({ post }: { post: Post }) => <article data-testid="post">{post.content}</article>,
}))

function posts(n: number): Post[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    community_id: 'c1',
    content: `Mensagem ${i + 1}`,
  })) as unknown as Post[]
}

function mockPosts(overrides: Record<string, unknown> = {}) {
  const loadMore = vi.fn()
  vi.mocked(usePosts).mockReturnValue({
    posts: posts(6),
    loading: false,
    error: null,
    createPost: vi.fn(),
    uploadPostImage: vi.fn(),
    reactionCounts: {},
    reactedPostIds: new Set<string>(),
    commentCounts: {},
    topLevelCounts: {},
    replyCountByComment: {},
    commentsByPost: {},
    previewCommentsByPost: {},
    toggleReaction: vi.fn(),
    fetchComments: vi.fn(),
    addComment: vi.fn(),
    hasMore: false,
    loadMore,
    loadingMore: false,
    ...overrides,
  } as never)
  return { loadMore }
}

describe('Feed — 6 mensagens principais por vez', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('pede ao hook uma página de 6 mensagens e não carrega prévia de comentários', () => {
    mockPosts()
    render(<Feed communityId="c1" authorId="u1" canPost />)

    expect(usePosts).toHaveBeenCalledWith(
      'c1',
      'u1',
      undefined,
      null,
      expect.objectContaining({ pageSize: 6 }),
    )
    const options = vi.mocked(usePosts).mock.calls[0][4] as { inlineConversation?: boolean }
    expect(options.inlineConversation).toBeFalsy()
  })

  it('mostra as 6 mensagens abertas e, havendo mais, deixa o resto atrás de "Ver mais mensagens"', () => {
    const { loadMore } = mockPosts({ hasMore: true })
    render(<Feed communityId="c1" authorId="u1" canPost />)

    expect(screen.getAllByTestId('post')).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais mensagens' }))
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('com 6 ou menos mensagens não mostra "Ver mais mensagens"', () => {
    mockPosts({ hasMore: false })
    render(<Feed communityId="c1" authorId="u1" canPost />)

    expect(screen.getAllByTestId('post')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Ver mais mensagens' })).not.toBeInTheDocument()
  })

  it('o compositor continua disponível para quem pode publicar', () => {
    mockPosts()
    render(<Feed communityId="c1" authorId="u1" canPost />)
    expect(screen.getByTestId('composer')).toBeInTheDocument()
  })
})
