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

describe('PostCard — conversa do feed aberta abaixo da mensagem', () => {
  afterEach(() => cleanup())

  it('com comentários, busca a conversa sozinho e mostra logo abaixo da mensagem', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    const { props, rerender } = setup({ commentCount: 1, topLevelCount: 1 })

    expect(screen.getByText('Bom dia, meninas!')).toBeInTheDocument()
    await waitFor(() => expect(props.onOpenComments).toHaveBeenCalledTimes(1))

    rerender(<PostCard {...props} comments={comments} />)
    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Escreva um comentário...')).toBeInTheDocument()
  })

  it('mostra até 6 comentários e recolhe os seguintes atrás de "Ver mais"', async () => {
    const comments = Array.from({ length: 8 }, (_, i) => comment('c' + i, 'Comentário ' + (i + 1)))
    setup({ commentCount: 8, topLevelCount: 8, comments })

    expect(await screen.findByText('Comentário 6')).toBeInTheDocument()
    expect(screen.queryByText('Comentário 7')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver mais 2 comentários/ }))
    expect(screen.getByText('Comentário 8')).toBeInTheDocument()
  })

  it('"Ocultar comentários" fecha a conversa e o aviso abre de novo', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    setup({ commentCount: 1, topLevelCount: 1, comments })

    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar comentários' }))
    expect(screen.queryByText('Que lindo!')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver 1 comentário/ }))
    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()
  })

  it('o botão de comentários (ícone) também fecha e abre a conversa', async () => {
    const comments = [comment('c1', 'Que lindo!')]
    setup({ commentCount: 1, topLevelCount: 1, comments })

    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(screen.queryByText('Que lindo!')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(await screen.findByText('Que lindo!')).toBeInTheDocument()
  })

  it('sem comentários, quem pode interagir já vê o campo para comentar (sem buscar nada)', () => {
    const { props } = setup({ commentCount: 0 })
    expect(screen.getByPlaceholderText('Escreva um comentário...')).toBeInTheDocument()
    expect(props.onOpenComments).not.toHaveBeenCalled()
  })

  it('quem não pode interagir e não há comentários só vê um aviso, sem campo', () => {
    setup({ commentCount: 0, canInteract: false })
    expect(screen.getByText('Ainda não há comentários.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Escreva um comentário...')).not.toBeInTheDocument()
  })

  it('curtir continua disponível', () => {
    const { props } = setup({ commentCount: 0, reactionCount: 4 })
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(props.onToggleReaction).toHaveBeenCalledTimes(1)
  })

  it('a foto do post aparece pequena e abre inteira ao tocar', () => {
    setup({ post: { ...POST, image_url: 'foto.webp' } as Post })
    expect(document.querySelector('.post-image-thumb img.post-image')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Foto ampliada' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a foto em tamanho maior' }))
    expect(screen.getByRole('dialog', { name: 'Foto ampliada' })).toBeInTheDocument()
  })
})
