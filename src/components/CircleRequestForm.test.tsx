import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CircleRequestForm } from './CircleRequestForm'

// Mocka o hook inteiro (não o supabase) — este teste prova o
// CONTRATO do formulário (só o nome é obrigatório, não deixa reenviar
// com pendência em aberto, mostra confirmação sem afirmar que o
// Círculo foi criado), não a query em si (já coberta por outros hooks
// no mesmo molde, ex. useGardenMember.test.ts).
const { createRequestMock, useCircleRequestsMock } = vi.hoisted(() => ({
  createRequestMock: vi.fn(),
  useCircleRequestsMock: vi.fn(),
}))

vi.mock('../hooks/useCircleRequests', () => ({
  useCircleRequests: useCircleRequestsMock,
}))

// CoverImageInput faz upload real — irrelevante para este teste de
// formulário (reference_image_path fica vazio o tempo todo).
vi.mock('./CoverImageInput', () => ({
  CoverImageInput: () => <div data-testid="cover-image-input" />,
}))

describe('CircleRequestForm', () => {
  beforeEach(() => {
    useCircleRequestsMock.mockReturnValue({
      myPendingRequest: null,
      createRequest: createRequestMock,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('não deixa enviar sem o nome sugerido (único campo obrigatório)', () => {
    render(<CircleRequestForm communityId="c1" profileId="p1" onBack={() => {}} />)

    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Qual nome você sugere/), {
      target: { value: 'Mães de primeira viagem' },
    })
    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).not.toBeDisabled()
  })

  it('envia só com o nome preenchido — os demais campos vão como null, nunca string vazia obrigatória', async () => {
    createRequestMock.mockResolvedValue({ error: null })
    render(<CircleRequestForm communityId="c1" profileId="p1" onBack={() => {}} />)

    fireEvent.change(screen.getByLabelText(/Qual nome você sugere/), {
      target: { value: 'Mães de primeira viagem' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))

    await waitFor(() => {
      expect(createRequestMock).toHaveBeenCalledWith('p1', {
        suggested_name: 'Mães de primeira viagem',
        topic: null,
        reason: null,
        activities: null,
        visual_idea: null,
        notes: null,
        reference_image_path: null,
      })
    })
  })

  it('mostra confirmação após enviar, sem afirmar que o Círculo foi criado', async () => {
    createRequestMock.mockResolvedValue({ error: null })
    render(<CircleRequestForm communityId="c1" profileId="p1" onBack={() => {}} />)

    fireEvent.change(screen.getByLabelText(/Qual nome você sugere/), {
      target: { value: 'Mães de primeira viagem' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))

    await waitFor(() => {
      expect(screen.getByText('Solicitação enviada!')).toBeInTheDocument()
    })
    expect(screen.queryByText(/círculo foi criado/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Qual nome você sugere/)).not.toBeInTheDocument()
  })

  it('com uma solicitação pendente já existente, mostra o status em vez do formulário', () => {
    useCircleRequestsMock.mockReturnValue({
      myPendingRequest: {
        id: 'r1',
        suggested_name: 'Clube do livro',
        status: 'pending',
      },
      createRequest: createRequestMock,
    })

    render(<CircleRequestForm communityId="c1" profileId="p1" onBack={() => {}} />)

    expect(screen.getByText('Você já tem uma solicitação em análise')).toBeInTheDocument()
    expect(screen.getByText('“Clube do livro”')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Qual nome você sugere/)).not.toBeInTheDocument()
  })

  it('mostra o erro do servidor sem travar o formulário', async () => {
    createRequestMock.mockResolvedValue({ error: 'Não foi possível enviar agora. Tente novamente.' })
    render(<CircleRequestForm communityId="c1" profileId="p1" onBack={() => {}} />)

    fireEvent.change(screen.getByLabelText(/Qual nome você sugere/), {
      target: { value: 'Clube do livro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))

    await waitFor(() => {
      expect(screen.getByText('Não foi possível enviar agora. Tente novamente.')).toBeInTheDocument()
    })
    // continua no formulário, não mostra a confirmação de sucesso
    expect(screen.getByLabelText(/Qual nome você sugere/)).toBeInTheDocument()
  })
})
