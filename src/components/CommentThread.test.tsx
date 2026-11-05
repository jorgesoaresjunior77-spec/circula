import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CommentThread } from './CommentThread'
import type { Comment } from '../types/post'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useSignedImageUrl', () => ({ useSignedImageUrl: () => ({ url: null }) }))
vi.mock('../hooks/useCommentLikes', async () => {
  const { createContext } = await import('react')
  return {
    CommentLikesContext: createContext(null),
    useCommentLikes: () => null,
    useCommentLikesContext: () => null,
  }
})

function make(id: string, content: string, parent: string | null = null, replies: Comment[] = []): Comment {
  return {
    id,
    post_id: 'p1',
    author_id: 'u1',
    content,
    created_at: '2026-11-04T11:00:00Z',
    parent_comment_id: parent,
    author: { id: 'u1', full_name: 'Bia', avatar_url: null },
    replies,
  }
}

const THREAD = make('c1', 'Que lindo!', null, [
  make('r1', 'Concordo!', 'c1'),
  make('r2', 'Também achei', 'c1'),
])

describe('CommentThread — respostas fechadas com aviso', () => {
  afterEach(() => cleanup())

  it('mostra o comentário e um aviso "Ver 2 respostas", sem as respostas abertas', () => {
    render(<CommentThread comment={THREAD} canInteract onReply={vi.fn()} />)

    expect(screen.getByText('Que lindo!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver 2 respostas/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Concordo!')).not.toBeInTheDocument()
  })

  it('clicar no aviso abre as respostas e vira "Ocultar respostas"', () => {
    render(<CommentThread comment={THREAD} canInteract onReply={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Ver 2 respostas/ }))
    expect(screen.getByText('Concordo!')).toBeInTheDocument()
    expect(screen.getByText('Também achei')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ocultar respostas/ }))
    expect(screen.queryByText('Concordo!')).not.toBeInTheDocument()
  })

  it('com 1 resposta o aviso fica no singular', () => {
    render(
      <CommentThread
        comment={make('c2', 'Oi', null, [make('r3', 'Olá', 'c2')])}
        canInteract
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Ver 1 resposta$/ })).toBeInTheDocument()
  })

  it('sem respostas não mostra aviso, só "Responder"', () => {
    render(<CommentThread comment={make('c3', 'Sozinho')} canInteract onReply={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Ver .* resposta/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Responder/ })).toBeInTheDocument()
  })

  it('responder continua disponível com as respostas fechadas e, ao responder, elas abrem', async () => {
    const onReply = vi.fn().mockResolvedValue({ error: null })
    render(<CommentThread comment={THREAD} canInteract onReply={onReply} />)

    expect(screen.queryByText('Concordo!')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Responder/ }))
    fireEvent.change(screen.getByPlaceholderText(/Responder a Bia/), { target: { value: 'Verdade!' } })
    const buttons = screen.getAllByRole('button', { name: 'Responder' })
    fireEvent.click(buttons[buttons.length - 1]) // o de enviar, dentro do formulário

    await waitFor(() => expect(onReply).toHaveBeenCalledWith('Verdade!', 'c1', null))
    expect(await screen.findByText('Concordo!')).toBeInTheDocument()
  })

  it('quem não pode interagir ainda vê o aviso das respostas, mas não "Responder"', () => {
    render(<CommentThread comment={THREAD} canInteract={false} />)
    expect(screen.getByRole('button', { name: /Ver 2 respostas/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Responder/ })).not.toBeInTheDocument()
  })
})

