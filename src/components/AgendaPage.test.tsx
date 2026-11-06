import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AgendaPage } from './AgendaPage'
import { useAppointments } from '../hooks/useAppointments'
import type { Appointment } from '../hooks/useAppointments'

vi.mock('../hooks/useAppointments')

const add = vi.fn()
const update = vi.fn()
const remove = vi.fn()

function mockHook(items: Appointment[] = []) {
  vi.mocked(useAppointments).mockReturnValue({
    items,
    loading: false,
    error: null,
    add,
    update,
    remove,
  })
}

const CONSULTA: Appointment = {
  id: 'a1',
  title: 'Consulta com a nutri',
  notes: 'Levar exames',
  // 5/11/2026 10:00 em São Paulo.
  starts_at: '2026-11-05T13:00:00.000Z',
  ends_at: '2026-11-05T14:00:00.000Z',
  all_day: false,
}

describe('AgendaPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
    add.mockResolvedValue({ error: null })
    update.mockResolvedValue({ error: null })
    remove.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('abre na visão semanal com os 7 dias e o aviso de dia vazio', () => {
    mockHook()
    render(<AgendaPage profileId="u1" />)

    expect(screen.getByRole('heading', { name: 'Novembro 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Nada marcado.')).toHaveLength(7)
    expect(screen.getByRole('region', { name: 'Qui, 5 de novembro' })).toBeInTheDocument()
  })

  it('mostra o compromisso no dia certo, com horário, nome e observações', () => {
    mockHook([CONSULTA])
    render(<AgendaPage profileId="u1" />)

    const dia = screen.getByRole('region', { name: 'Qui, 5 de novembro' })
    expect(dia).toHaveTextContent('10:00 – 11:00')
    expect(dia).toHaveTextContent('Consulta com a nutri')
    expect(dia).toHaveTextContent('Levar exames')
    expect(screen.getAllByText('Nada marcado.')).toHaveLength(6)
  })

  it('consulta semanas anteriores e seguintes', () => {
    mockHook()
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    expect(screen.getByRole('region', { name: 'Seg, 9 de novembro' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(screen.getByRole('region', { name: 'Seg, 26 de outubro' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(screen.getByRole('region', { name: 'Qui, 5 de novembro' })).toBeInTheDocument()
  })

  it('a visão mensal mostra a grade, marca dias com compromisso e lista o dia selecionado', () => {
    mockHook([CONSULTA])
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Mês' }))
    expect(
      screen.getByRole('button', { name: 'Qui, 5 de novembro, com compromissos' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sex, 6 de novembro' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Qui, 5 de novembro' })).toHaveTextContent(
      'Consulta com a nutri',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sex, 6 de novembro' }))
    expect(screen.getByRole('region', { name: 'Sex, 6 de novembro' })).toHaveTextContent(
      'Nada marcado.',
    )
  })

  it('cria um compromisso: converte o horário de São Paulo para UTC', async () => {
    mockHook()
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo compromisso' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Yoga' } })
    fireEvent.change(screen.getByLabelText('Começa'), { target: { value: '18:30' } })
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Tapete' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    expect(add).toHaveBeenCalledWith({
      title: 'Yoga',
      notes: 'Tapete',
      starts_at: '2026-11-05T21:30:00.000Z',
      ends_at: null,
      all_day: false,
    })
  })

  it('compromisso de dia todo grava 00:00 do dia e não pede horário', async () => {
    mockHook()
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo compromisso' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Feriado' } })
    fireEvent.click(screen.getByLabelText('Dia todo'))
    expect(screen.queryByLabelText('Começa')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(add).toHaveBeenCalled())
    expect(add.mock.calls[0][0]).toMatchObject({
      starts_at: '2026-11-05T03:00:00.000Z',
      ends_at: null,
      all_day: true,
      notes: null,
    })
  })

  it('não salva sem nome nem com o fim antes do começo', async () => {
    mockHook()
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo compromisso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Dê um nome ao compromisso.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Começa'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Termina (opcional)'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('O fim não pode ser antes do começo.')).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('edita um compromisso existente', async () => {
    mockHook([CONSULTA])
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: /Consulta com a nutri/ }))
    expect(screen.getByLabelText('Nome')).toHaveValue('Consulta com a nutri')
    expect(screen.getByLabelText('Começa')).toHaveValue('10:00')
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Consulta remarcada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toBe('a1')
    expect(update.mock.calls[0][1]).toMatchObject({ title: 'Consulta remarcada' })
    expect(add).not.toHaveBeenCalled()
  })

  it('excluir pede confirmação antes de apagar', async () => {
    mockHook([CONSULTA])
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: /Consulta com a nutri/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('a1'))
  })

  it('mostra o erro do servidor sem fechar o formulário', async () => {
    mockHook()
    add.mockResolvedValue({ error: 'Não foi possível salvar o compromisso. Tente de novo.' })
    render(<AgendaPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo compromisso' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Yoga' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Não foi possível salvar o compromisso/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Yoga')
  })
})
