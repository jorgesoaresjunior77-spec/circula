import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { WaterPage } from './WaterPage'
import { useWater } from '../hooks/useWater'
import type { WaterLog, WaterDay } from '../hooks/useWater'

vi.mock('../hooks/useWater')

const saveWeight = vi.fn()
const clearWeight = vi.fn()
const addLog = vi.fn()
const updateLog = vi.fn()
const removeLog = vi.fn()

function mockWater(
  over: Partial<{
    weightKg: number | null
    todayLogs: WaterLog[]
    todayTotalMl: number
    history: WaterDay[]
  }> = {},
) {
  vi.mocked(useWater).mockReturnValue({
    today: '2026-11-05',
    loading: false,
    error: null,
    weightKg: null,
    todayLogs: [],
    todayTotalMl: 0,
    history: [],
    saveWeight,
    clearWeight,
    addLog,
    updateLog,
    removeLog,
    ...over,
  })
}

describe('WaterPage — calculadora de água', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sem peso, pede o peso e explica que a meta é uma estimativa educativa', () => {
    mockWater()
    render(<WaterPage profileId="u1" />)

    expect(screen.getByLabelText('Seu peso (kg)')).toBeInTheDocument()
    expect(screen.getByText(/estimativa educativa, não uma prescrição/)).toBeInTheDocument()
    expect(screen.getByText(/restrição de líquidos/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Registrar água' })).not.toBeInTheDocument()
  })

  it('calcula e salva a meta a partir do peso (vírgula aceita)', async () => {
    saveWeight.mockResolvedValue({ error: null })
    mockWater()
    render(<WaterPage profileId="u1" />)

    fireEvent.change(screen.getByLabelText('Seu peso (kg)'), { target: { value: '62,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Calcular minha meta' }))

    await waitFor(() => expect(saveWeight).toHaveBeenCalledWith(62.5))
  })

  it('recusa peso fora do aceitável, sem salvar', async () => {
    mockWater()
    render(<WaterPage profileId="u1" />)

    fireEvent.change(screen.getByLabelText('Seu peso (kg)'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Calcular minha meta' }))

    expect(await screen.findByText(/peso entre 20 e 300 kg/)).toBeInTheDocument()
    expect(saveWeight).not.toHaveBeenCalled()
  })

  it('com peso, mostra a meta em litros e mililitros e a garrafa vazia', () => {
    mockWater({ weightKg: 70 })
    render(<WaterPage profileId="u1" />)

    expect(screen.getByText('2,45 L')).toBeInTheDocument()
    expect(screen.getByText('(2.450 ml)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /0% da meta/ })).toBeInTheDocument()
    expect(screen.queryByText(/Meta de hoje concluída/)).not.toBeInTheDocument()
  })

  it('atualiza o progresso e a garrafa conforme a água registrada', () => {
    mockWater({
      weightKg: 70,
      todayTotalMl: 1225,
      todayLogs: [{ id: 'l1', day: '2026-11-05', amount_ml: 1225 }],
    })
    render(<WaterPage profileId="u1" />)

    expect(screen.getAllByText('1.225 ml')).toHaveLength(2) // total do dia e o registro
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /50% da meta/ })).toBeInTheDocument()
  })

  it('ao atingir a meta, mostra a mensagem de incentivo', () => {
    mockWater({
      weightKg: 70,
      todayTotalMl: 2450,
      todayLogs: [{ id: 'l1', day: '2026-11-05', amount_ml: 2450 }],
    })
    render(<WaterPage profileId="u1" />)

    expect(screen.getByRole('status')).toHaveTextContent('Meta de hoje concluída')
    expect(screen.getByRole('img', { name: /100% da meta/ })).toBeInTheDocument()
  })

  it('registra água pelos botões rápidos e por uma quantidade própria', async () => {
    addLog.mockResolvedValue({ error: null })
    mockWater({ weightKg: 70 })
    render(<WaterPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: '+300 ml' }))
    await waitFor(() => expect(addLog).toHaveBeenCalledWith(300))

    fireEvent.change(screen.getByLabelText('Outra quantidade (ml)'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(addLog).toHaveBeenCalledWith(150))
  })

  it('não registra quantidade inválida', async () => {
    mockWater({ weightKg: 70 })
    render(<WaterPage profileId="u1" />)

    fireEvent.change(screen.getByLabelText('Outra quantidade (ml)'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText(/entre 1 e 2000 ml/)).toBeInTheDocument()
    expect(addLog).not.toHaveBeenCalled()
  })

  it('corrige e remove um registro de hoje', async () => {
    updateLog.mockResolvedValue({ error: null })
    removeLog.mockResolvedValue({ error: null })
    mockWater({
      weightKg: 70,
      todayTotalMl: 300,
      todayLogs: [{ id: 'l1', day: '2026-11-05', amount_ml: 300 }],
    })
    render(<WaterPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir' }))
    fireEvent.change(screen.getByLabelText('Nova quantidade em ml'), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(updateLog).toHaveBeenCalledWith('l1', 250))

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(removeLog).toHaveBeenCalledWith('l1'))
  })

  it('separa o histórico por dia', () => {
    mockWater({
      weightKg: 70,
      history: [
        { day: '2026-11-04', totalMl: 2100 },
        { day: '2026-11-03', totalMl: 1500 },
      ],
    })
    render(<WaterPage profileId="u1" />)

    expect(screen.getByText('Dias anteriores')).toBeInTheDocument()
    expect(screen.getByText('4 de novembro')).toBeInTheDocument()
    expect(screen.getByText('2.100 ml')).toBeInTheDocument()
    expect(screen.getByText('3 de novembro')).toBeInTheDocument()
  })

  it('permite alterar e apagar o peso (dado de saúde)', async () => {
    clearWeight.mockResolvedValue({ error: null })
    mockWater({ weightKg: 70 })
    render(<WaterPage profileId="u1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Apagar meu peso' }))
    await waitFor(() => expect(clearWeight).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Alterar peso' }))
    expect(screen.getByLabelText('Seu peso (kg)')).toBeInTheDocument()
  })
})
