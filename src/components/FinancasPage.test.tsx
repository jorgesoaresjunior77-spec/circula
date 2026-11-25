import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { FinancasPage } from './FinancasPage'
import { CATEGORIAS_PADRAO, chaveAtual } from '../lib/financas'
import type { FinLancamento } from '../lib/financas'

let lancs: FinLancamento[] = []
const adicionar = vi.fn(async () => null)
vi.mock('../hooks/useFinancas', () => ({
  useFinancas: () => ({
    lancs,
    error: null,
    categorias: (tipo: string) => CATEGORIAS_PADRAO.filter((c) => c.tipo === tipo),
    todasCategorias: CATEGORIAS_PADRAO,
    adicionar,
    editar: vi.fn(async () => null),
    apagar: vi.fn(async () => null),
    criarCategoria: vi.fn(async () => null),
    excluirCategoria: vi.fn(async () => null),
  }),
}))
vi.mock('../hooks/useRobo', () => ({ useRobo: () => ({ mudo: false, falas: 0, cena: null, falar: vi.fn(), alternarMudo: vi.fn() }) }))
vi.mock('./RoboGuia', () => ({ RoboGuia: ({ cena }: { cena: string }) => <div data-testid="robo" data-cena={cena} /> }))

const l = (p: Partial<FinLancamento>): FinLancamento => ({
  id: Math.random().toString(),
  tipo: 'gasto',
  categoria: 'padrao:mercado',
  valor_centavos: 1000,
  data: `${chaveAtual()}-10`,
  observacao: null,
  movimento: null,
  parcela_grupo: null,
  parcela_n: null,
  parcela_total: null,
  ...p,
})

describe('FinancasPage', () => {
  afterEach(() => {
    cleanup()
    adicionar.mockClear()
    lancs = []
  })

  it('mês vazio convida a começar e o robô fica em repouso', () => {
    render(<FinancasPage />)
    expect(screen.getByText(/Vamos começar/)).toBeInTheDocument()
    expect(screen.getByTestId('robo')).toHaveAttribute('data-cena', 'neutro')
  })

  it('mês devendo deixa o robô preocupado em repouso (gastos > receitas)', () => {
    lancs = [l({ tipo: 'receita', categoria: 'padrao:salario', valor_centavos: 1000 }), l({ valor_centavos: 5000 })]
    render(<FinancasPage />)
    expect(screen.getByText(/gastos passaram das receitas/)).toBeInTheDocument()
    expect(screen.getByTestId('robo')).toHaveAttribute('data-cena', 'pensando')
  })

  it('lança um gasto parcelado: 3x, última parcela absorve a diferença, e o robô reage', async () => {
    render(<FinancasPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gastos' }))
    fireEvent.click(screen.getByRole('button', { name: /^Mercado, / }))
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByLabelText('Compra parcelada'))
    fireEvent.change(screen.getByLabelText('Número de parcelas (2 a 48)'), { target: { value: '3' } })
    expect(screen.getByText(/3x de R\$ 333,33/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(adicionar).toHaveBeenCalled())
    const rows = (adicionar.mock.calls[0] as unknown as [{ valor_centavos: number; parcela_n: number; parcela_total: number }[]])[0]
    expect(rows.map((r) => r.valor_centavos)).toEqual([33333, 33333, 33334])
    expect(rows.map((r) => r.parcela_n)).toEqual([1, 2, 3])
    expect(screen.getByText(/Mais uma conta|passaram das receitas/)).toBeInTheDocument()
  })

  it('receita deixa o robô feliz', async () => {
    render(<FinancasPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Receitas' }))
    fireEvent.click(screen.getByRole('button', { name: /^Salário, / }))
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '2500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.getByText('Entrou dinheiro! Que alegria!')).toBeInTheDocument())
    expect(screen.getByTestId('robo')).toHaveAttribute('data-cena', 'feliz')
  })

  it('rejeita valor zero e dia fora de 1 a 31', async () => {
    render(<FinancasPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gastos' }))
    fireEvent.click(screen.getByRole('button', { name: /^Mercado, / }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe um valor maior que zero.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Dia do pagamento ou vencimento'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('O dia precisa ser de 1 a 31.')).toBeInTheDocument()
    expect(adicionar).not.toHaveBeenCalled()
  })
})
