import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ReadingTipsPage } from './ReadingTipsPage'
import { useManagedContent } from '../hooks/useManagedContent'
import type { ReadingTip } from '../lib/wellnessContent'

vi.mock('../hooks/useManagedContent')
vi.mock('../hooks/useSignedImageUrl', () => ({ useSignedImageUrl: () => ({ url: null }) }))
vi.mock('./CoverImageInput', () => ({ CoverImageInput: () => <div data-testid="cover-input" /> }))

const save = vi.fn()
const remove = vi.fn()

function mockContent(items: ReadingTip[] = [], loading = false) {
  vi.mocked(useManagedContent).mockReturnValue({
    items,
    loading,
    error: null,
    save,
    remove,
  } as never)
}

const LIVRO: ReadingTip = {
  id: 't1',
  community_id: 'c1',
  theme: 'saude',
  title: 'Livro de teste',
  author: 'Autora de teste',
  summary: 'Um resumo.',
  key_learnings: 'Aprendizado 1',
  why_recommended: 'Porque sim.',
  cover_image_url: null,
  status: 'published',
}

describe('ReadingTipsPage — Dicas de Leitura', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sem nenhum livro, a aluna vê um aviso e nada inventado', () => {
    mockContent([])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner={false} />)

    expect(screen.getByText(/ainda não foram publicadas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo livro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('mostra o livro com título, autor, resumo, aprendizados e motivo, no tema certo', () => {
    mockContent([LIVRO])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner={false} />)

    expect(screen.getByRole('region', { name: 'Saúde' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Livro de teste' })).toBeInTheDocument()
    expect(screen.getByText('Autora de teste')).toBeInTheDocument()
    expect(screen.getByText('Um resumo.')).toBeInTheDocument()
    expect(screen.getByText('Aprendizado 1')).toBeInTheDocument()
    expect(screen.getByText('Porque sim.')).toBeInTheDocument()
  })

  it('só mostra os temas que têm livro', () => {
    mockContent([LIVRO])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner={false} />)
    expect(screen.queryByRole('region', { name: 'Longevidade' })).not.toBeInTheDocument()
  })

  it('a aluna não vê botões de cadastro nem de edição', () => {
    mockContent([LIVRO])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner={false} />)
    expect(screen.queryByRole('button', { name: 'Novo livro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('a profissional cadastra um livro', async () => {
    save.mockResolvedValue({ error: null })
    mockContent([])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo livro' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Meu livro' } })
    fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Alguém' } })
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'neurociencia' } })
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'published' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(null, {
      theme: 'neurociencia',
      title: 'Meu livro',
      author: 'Alguém',
      summary: null,
      key_learnings: null,
      why_recommended: null,
      cover_image_url: null,
      status: 'published',
    })
  })

  it('não salva sem título ou sem autor', async () => {
    mockContent([])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo livro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Preencha o título e o autor do livro.')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('a profissional edita e exclui (com confirmação) e vê o rascunho marcado', async () => {
    save.mockResolvedValue({ error: null })
    remove.mockResolvedValue({ error: null })
    mockContent([{ ...LIVRO, status: 'draft' }])
    render(<ReadingTipsPage communityId="c1" profileId="p1" isOwner />)

    expect(screen.getByText(/Rascunho — só você vê/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Título')).toHaveValue('Livro de teste')

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('t1'))
  })
})
