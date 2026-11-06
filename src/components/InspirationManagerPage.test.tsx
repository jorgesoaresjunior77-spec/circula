import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { InspirationManagerPage } from './InspirationManagerPage'
import { useManagedContent } from '../hooks/useManagedContent'

vi.mock('../hooks/useManagedContent')

const save = vi.fn()
const remove = vi.fn()

function mockContent(items: unknown[] = []) {
  vi.mocked(useManagedContent).mockReturnValue({
    items,
    loading: false,
    error: null,
    save,
    remove,
  } as never)
}

describe('InspirationManagerPage — mensagens do dia', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('explica que o app não escreve frases e que só entram citações com fonte', () => {
    mockContent([])
    render(<InspirationManagerPage communityId="c1" />)
    expect(screen.getByText(/Só publique citações cuja fonte você conferiu/)).toBeInTheDocument()
    expect(screen.getByText('Nenhuma mensagem cadastrada ainda.')).toBeInTheDocument()
  })

  it('cadastra uma citação com autor e obra', async () => {
    save.mockResolvedValue({ error: null })
    mockContent([])
    render(<InspirationManagerPage communityId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova mensagem' }))
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Texto da citação' } })
    fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Autora' } })
    fireEvent.change(screen.getByLabelText('Obra'), { target: { value: 'Livro' } })
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'published' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(null, {
      kind: 'citacao',
      body: 'Texto da citação',
      author: 'Autora',
      source: 'Livro',
      status: 'published',
    })
  })

  it('recusa citação sem autor ou sem obra (sem fonte não entra)', async () => {
    mockContent([])
    render(<InspirationManagerPage communityId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova mensagem' }))
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Frase solta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Citação precisa de autor e de obra/)).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('texto editorial não pede autor nem obra', async () => {
    save.mockResolvedValue({ error: null })
    mockContent([])
    render(<InspirationManagerPage communityId="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova mensagem' }))
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'editorial' } })
    expect(screen.queryByLabelText('Autor')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Respire.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][1]).toMatchObject({ kind: 'editorial', author: null, source: null })
  })

  it('lista as mensagens com a situação e conta as publicadas', () => {
    mockContent([
      { id: 'a', kind: 'editorial', body: 'Um', author: null, source: null, status: 'published', created_at: '1' },
      { id: 'b', kind: 'editorial', body: 'Dois', author: null, source: null, status: 'draft', created_at: '2' },
    ])
    render(<InspirationManagerPage communityId="c1" />)
    expect(screen.getByText('1 publicada de 2.')).toBeInTheDocument()
    expect(screen.getByText(/Rascunho/)).toBeInTheDocument()
  })
})
