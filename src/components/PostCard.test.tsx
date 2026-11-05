import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PostCard } from './PostCard'
import type { Comment, Post } from '../types/post'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useSignedImageUrl', () => ({
  useSignedImageUrl: (path: string | null) => ({ url: path ? `https://img.test/${path}` : null }),
}))
vi.mock('../hooks/useCommentLikes', async () => {
  const { createContext } = await import('react')
  return {
    CommentLikesContext: createContext(null),
    useCommentLikes: () => null,
    useCommentLikesContext: () => null,
  }
})

const POST = {
  id: 'p1',
  community_id: 'c1',
  circle_id: null,
  author_id: 'a1',
  content: 'Bom dia, meninas!',
  image_url: null,
  created_at: '2026-11-04T10:00:00Z',
  post_type: 'standard',
  question_id: null,
  title: null,
  engagement_command_id: null,
  author: { id: 'a1', full_name: 'Ana', avatar_url: null },
} as unknown as Post

function comment(id: string, content: string, replies: Comment[] = []): Comment {
  return {
    id,
    post_id: 'p1',
    author_id: 'u1',
    content,
    created_at: '2026-11-04T11:00:00Z',
    parent_comment_id: null,
    author: { id: 'u1', full_name: 'Bia', avatar_url: null },
    replies,
  }
}

function setup(overrides: Partial<React.ComponentProps<typeof PostCard>> = {}) {
  const props = {
    post: POST,
    reactionCount: 0,
    hasReacted: false,
    commentCount: 0,
    comments: undefined,
    canInteract: true,
    onToggleReaction: vi.fn().mockResolvedValue({ error: null }),
    onOpenComments: vi.fn().mockResolvedValue({ error: null }),
    onAddComment: vi.fn().mockResolvedValue({ error: null }),
    viewerId: 'v1',
    inlineConversation: true,
    topLevelCount: 0,
    ...overrides,
  }
  return { props, ...render(<PostCard {...props} />) }
}

describe('PostCard — conversa do feed fechada com aviso', () => {
  afterEach(() => cleanup())

  it('mostra a mensagem e só um aviso para abrir os comentários e respostas (nada aberto)', () => {
    setup({ commentCount: 5, topLevelCount: 3 })

    expect(screen.getByText('Bom dia, meninas!')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ver 3 comentários e 2 respostas/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByPlaceholderText('Escreva um comentário...')).not.toBeInTheDocument()
  })

  it('o aviso conta só comentários quando não há respostas', () => {
    setup({ commentCount: 1, topLevelCount: 1 })
    expect(screen.getByRole('button', { name: /Ver 1 comentário$/ })).toBeInTheDocument()
  })

  it('clicar no aviso carrega a conversa e abre os comentários com o campo para comentar', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    const { props, rerender } = setup({ commentCount: 1, topLevelCount: 1 })

    fireEvent.click(screen.getByRole('button', { name: /Ver 1 comentário/ }))
    expect(props.onOpenComments).toHaveBeenCalledTimes(1)

    rerender(<PostCard {...props} comments={comments} />)
    await waitFor(() => expect(screen.getByText('Que lindo!')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Escreva um comentário...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar comentários' })).toBeInTheDocument()
  })

  it('"Ocultar comentários" fecha a conversa de novo', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    setup({ commentCount: 1, topLevelCount: 1, comments })

    fireEvent.click(screen.getByRole('button', { name: /Ver 1 comentário/ }))
    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar comentários' }))
    expect(screen.queryByText('Que lindo!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver 1 comentário/ })).toBeInTheDocument()
  })

  it('o botão de comentários (ícone) também abre e fecha a conversa', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    setup({ commentCount: 1, topLevelCount: 1, comments })

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(screen.queryByText('Que lindo!')).not.toBeInTheDocument()
  })

  it('sem comentários, quem pode interagir vê "Comentar", que abre o campo', async () => {
    const { props, rerender } = setup({ commentCount: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }))
    rerender(<PostCard {...props} comments={[]} />)

    expect(await screen.findByPlaceholderText('Escreva um comentário...')).toBeInTheDocument()
    expect(screen.getByText(/Ainda não há comentários/)).toBeInTheDocument()
  })

  it('quem não pode interagir e não há comentários só vê um aviso, sem botão', () => {
    setup({ commentCount: 0, canInteract: false })
    expect(screen.getByText('Ainda não há comentários.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comentar' })).not.toBeInTheDocument()
  })

  it('curtir continua disponível com a conversa fechada', () => {
    const { props } = setup({ commentCount: 2, topLevelCount: 2, reactionCount: 4 })
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(props.onToggleReaction).toHaveBeenCalledTimes(1)
  })

  it('a foto do post usa a classe de imagem 4:5', () => {
    setup({ post: { ...POST, image_url: 'foto.webp' } as Post })
    const img = document.querySelector('img.post-image')
    expect(img).not.toBeNull()
  })
})
