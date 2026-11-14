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

describe('CommentThread — respostas à vista (até 6), o resto recolhido', () => {
  afterEach(() => cleanup())

  it('mostra o comentário com as respostas logo abaixo, já abertas', () => {
    render(<CommentThread comment={THREAD} canInteract onReply={vi.fn()} />)

    expect(screen.getByText('Que lindo!')).toBeInTheDocument()
    expect(screen.getByText('Concordo!')).toBeInTheDocument()
    expect(screen.getByText('Também achei')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ocultar respostas/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('"Ocultar respostas" recolhe e "Ver 2 respostas" abre de novo', () => {
    render(<CommentThread comment={THREAD} canInteract onReply={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Ocultar respostas/ }))
    expect(screen.queryByText('Concordo!')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver 2 respostas/ }))
    expect(screen.getByText('Concordo!')).toBeInTheDocument()
  })

  it('com mais de 6 respostas, mostra 6 e recolhe as seguintes atrás de "Ver mais"', () => {
    const many = Array.from({ length: 8 }, (_, i) => make('m' + i, 'Resposta ' + (i + 1), 'c9'))
    render(<CommentThread comment={make('c9', 'Muitas', null, many)} canInteract onReply={vi.fn()} />)

    expect(screen.getByText('Resposta 6')).toBeInTheDocument()
    expect(screen.queryByText('Resposta 7')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver mais 2 respostas/ }))
    expect(screen.getByText('Resposta 8')).toBeInTheDocument()
  })

  it('sem respostas não mostra aviso, só "Responder"', () => {
    render(<CommentThread comment={make('c3', 'Sozinho')} canInteract onReply={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /respostas?$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Responder/ })).toBeInTheDocument()
  })

  it('responder envia a resposta para o comentário-raiz', async () => {
    const onReply = vi.fn().mockResolvedValue({ error: null })
    render(<CommentThread comment={make('c4', 'Só eu')} canInteract onReply={onReply} />)

    fireEvent.click(screen.getByRole('button', { name: /Responder/ }))
    fireEvent.change(screen.getByPlaceholderText(/Responder a Bia/), { target: { value: 'Verdade!' } })
    const buttons = screen.getAllByRole('button', { name: 'Responder' })
    fireEvent.click(buttons[buttons.length - 1]) // o de enviar, dentro do formulário

    await waitFor(() => expect(onReply).toHaveBeenCalledWith('Verdade!', 'c4', null))
  })

  it('quem não pode interagir lê as respostas, mas não vê "Responder"', () => {
    render(<CommentThread comment={THREAD} canInteract={false} />)
    expect(screen.getByText('Concordo!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Responder/ })).not.toBeInTheDocument()
  })
})
