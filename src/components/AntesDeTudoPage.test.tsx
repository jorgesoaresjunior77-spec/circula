import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AntesDeTudoPage } from './AntesDeTudoPage'
import { useHabits } from '../hooks/useHabits'
import type { HabitDay } from '../hooks/useHabits'

vi.mock('../hooks/useHabits')

const toggle = vi.fn()

function mockHabits(checked: string[] = [], history: HabitDay[] = []) {
  vi.mocked(useHabits).mockReturnValue({
    today: '2026-11-05',
    loading: false,
    error: null,
    checkedToday: new Set(checked),
    history,
    toggle,
  })
}

describe('AntesDeTudoPage — ritual diário', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra o título, o subtítulo e os 7 hábitos', () => {
    mockHabits()
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'ANTES DE TUDO' })).toBeInTheDocument()
    expect(screen.getByText('Pequenos hábitos. Uma vida melhor.')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    expect(screen.getByRole('checkbox', { name: 'Luz da manhã' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Conexão com a espiritualidade' })).toBeInTheDocument()
  })

  it('começa em preto e branco, sem culpa, e conta os checks do dia', () => {
    mockHabits()
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    expect(screen.getByText('0 de 7')).toBeInTheDocument()
    expect(screen.getByText(/Cada dia é um começo novo/)).toBeInTheDocument()
    const art = screen.getByRole('img', { name: /0 de 7/ })
    expect(art).toHaveStyle({ filter: 'grayscale(1)' })
  })

  it('a ilustração ganha cor conforme os hábitos são marcados', () => {
    mockHabits(['luz', 'agua', 'leitura', 'respiracao'])
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    expect(screen.getByText('4 de 7')).toBeInTheDocument()
    const art = screen.getByRole('img', { name: /4 de 7/ })
    const amount = Number(/grayscale\(([\d.]+)\)/.exec(art.style.filter)?.[1])
    expect(amount).toBeCloseTo(3 / 7, 5)
    expect(screen.getByRole('checkbox', { name: 'Beber água' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Exercício e movimento' })).toHaveAttribute('aria-checked', 'false')
  })

  it('com os 7 marcados, a ilustração fica colorida', () => {
    mockHabits(['luz', 'agua', 'exercicio', 'leitura', 'respiracao', 'organizacao', 'espiritualidade'])
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    expect(screen.getByRole('img', { name: /7 de 7/ })).toHaveStyle({ filter: 'grayscale(0)' })
    expect(screen.getByText(/Ritual completo de hoje/)).toBeInTheDocument()
  })

  it('marcar e desmarcar chama o toggle com o hábito certo', async () => {
    toggle.mockResolvedValue({ error: null })
    mockHabits(['agua'])
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Luz da manhã' }))
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('luz'))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beber água' }))
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('agua'))
  })

  it('cada hábito integrado abre a tela certa', () => {
    mockHabits()
    const onNavigate = vi.fn()
    render(<AntesDeTudoPage profileId="u1" onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a calculadora de água' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir as dicas de leitura' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respiração e meditação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a agenda' }))

    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['agua', 'leitura', 'respiracao', 'agenda'])
  })

  it('luz natural e espiritualidade não têm atalho, só o check', () => {
    mockHabits()
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(4)
  })

  it('o histórico mostra os dias anteriores sem marcar falhas', () => {
    mockHabits([], [
      { day: '2026-11-04', count: 5 },
      { day: '2026-11-02', count: 2 },
    ])
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    expect(screen.getByLabelText('4 de novembro: 5 de 7 hábitos')).toBeInTheDocument()
    expect(screen.getByLabelText('2 de novembro: 2 de 7 hábitos')).toBeInTheDocument()
    // Dia sem registro: só um dia em branco, sem nenhuma mensagem de falha.
    expect(screen.getByLabelText('3 de novembro: 0 de 7 hábitos')).toBeInTheDocument()
    expect(screen.queryByText(/falhou|perdeu|quebrou/i)).not.toBeInTheDocument()
  })

  it('mostra o erro ao salvar sem perder o estado da tela', async () => {
    toggle.mockResolvedValue({ error: 'Não foi possível salvar agora. Tente de novo.' })
    mockHabits()
    render(<AntesDeTudoPage profileId="u1" onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Luz da manhã' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar agora')
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
  })
})
