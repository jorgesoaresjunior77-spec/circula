import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { BreathingPage } from './BreathingPage'
import { useManagedContent } from '../hooks/useManagedContent'
import type { WellnessSession } from '../lib/wellnessContent'

vi.mock('../hooks/useManagedContent')

const save = vi.fn()
const remove = vi.fn()

function mockContent(items: WellnessSession[] = []) {
  vi.mocked(useManagedContent).mockReturnValue({
    items,
    loading: false,
    error: null,
    save,
    remove,
  } as never)
}

const SESSAO: WellnessSession = {
  id: 's1',
  community_id: 'c1',
  kind: 'respiracao',
  title: 'Pausa de respiração',
  instructions: 'Sente-se com conforto.',
  duration_minutes: 5,
  audio_url: 'https://exemplo.com/a.mp3',
  status: 'published',
}

describe('BreathingPage — Respiração e Meditação', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra o aviso de cuidado e, sem conteúdo, um aviso de que virá depois', () => {
    mockContent([])
    render(<BreathingPage communityId="c1" isOwner={false} />)

    expect(screen.getByText(/pare se sentir tontura ou desconforto/)).toBeInTheDocument()
    expect(screen.getByText(/ainda não foram publicadas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova sessão' })).not.toBeInTheDocument()
  })

  it('mostra a sessão no tipo certo, com duração, orientações e áudio', () => {
    mockContent([SESSAO])
    const { container } = render(<BreathingPage communityId="c1" isOwner={false} />)

    expect(screen.getByRole('region', { name: 'Respiração guiada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pausa de respiração' })).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument()
    expect(screen.getByText('Sente-se com conforto.')).toBeInTheDocument()
    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://exemplo.com/a.mp3')
  })

  it('sessões de durações diferentes aparecem com a duração formatada', () => {
    mockContent([
      SESSAO,
      { ...SESSAO, id: 's2', title: 'Longa', duration_minutes: 90, audio_url: null },
    ])
    render(<BreathingPage communityId="c1" isOwner={false} />)
    expect(screen.getByText('5 min')).toBeInTheDocument()
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument()
  })

  it('a profissional cadastra uma sessão', async () => {
    save.mockResolvedValue({ error: null })
    mockContent([])
    render(<BreathingPage communityId="c1" isOwner />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Respirar' } })
    fireEvent.change(screen.getByLabelText('Duração (minutos)'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Link do áudio (opcional, https)'), {
      target: { value: 'https://exemplo.com/x.mp3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(null, {
      kind: 'respiracao',
      title: 'Respirar',
      instructions: null,
      duration_minutes: 7,
      audio_url: 'https://exemplo.com/x.mp3',
      status: 'draft',
    })
  })

  it('recusa áudio sem https e duração fora do aceitável', async () => {
    mockContent([])
    render(<BreathingPage communityId="c1" isOwner />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Link do áudio (opcional, https)'), {
      target: { value: 'http://exemplo.com/x.mp3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('O link do áudio precisa começar com https://.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Duração (minutos)'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('A duração deve ser de 1 a 120 minutos.')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
})
