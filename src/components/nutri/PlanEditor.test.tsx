import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanEditor, emptyPlan } from './PlanEditor'
import type { Food } from '../../lib/nutriPlan'

const arroz: Food = {
  id: 'f1', name: 'Arroz, tipo 1, cozido', category: 'Cereais', portion_label: '4 colheres', portion_g: 100,
  kcal: 128, protein_g: 2.5, carb_g: 28.1, fat_g: 0.2, sat_fat_g: null, fiber_g: 1.6, sodium_mg: 1, source: 'importada',
}

const basics = { sex: 'F' as const, age: 30, weightKg: 60, heightCm: 165 }

afterEach(cleanup)

describe('PlanEditor — fluxo da nutricionista', () => {
  it('adiciona alimento do banco, recalcula pela quantidade e mostra o total do dia', () => {
    const onSave = vi.fn().mockResolvedValue({ error: null })
    render(<PlanEditor initial={{ ...emptyPlan(), name: 'Plano A' }} foods={[arroz]} recipes={[]} basics={basics} onSave={onSave} onCancel={() => {}} />)

    // busca no 1º campo de busca (café da manhã) e escolhe o alimento
    fireEvent.change(screen.getAllByLabelText('Buscar alimento')[0], { target: { value: 'arroz' } })
    fireEvent.click(screen.getByRole('button', { name: /Arroz, tipo 1, cozido/ }))

    expect(screen.getByText(/128 kcal · P 2.5/)).toBeInTheDocument()

    // dobra a quantidade: 200 g => 256 kcal
    fireEvent.change(screen.getByLabelText('Gramas'), { target: { value: '200' } })
    const resumo = screen.getByLabelText('Resumo do dia')
    expect(within(resumo).getByText(/256 kcal/)).toBeInTheDocument()
  })

  it('mostra a fórmula da estimativa e só vira meta ao clicar', () => {
    render(<PlanEditor initial={emptyPlan()} foods={[]} recipes={[]} basics={basics} onSave={vi.fn()} onCancel={() => {}} />)
    expect(screen.getAllByText(/Mifflin-St Jeor/).length).toBeGreaterThan(0)
    expect(screen.getByText(/× 1.375/)).toBeInTheDocument()
    const meta = screen.getByLabelText('Valor energético prescrito (kcal)') as HTMLInputElement
    expect(meta.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Usar como meta' }))
    expect((screen.getByLabelText('Valor energético prescrito (kcal)') as HTMLInputElement).value).toBe('1815')
  })

  it('exige nome do plano para salvar e duplica uma refeição', () => {
    const onSave = vi.fn().mockResolvedValue({ error: null })
    render(<PlanEditor initial={emptyPlan()} foods={[]} recipes={[]} basics={basics} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar plano' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome ao plano.')
    expect(onSave).not.toHaveBeenCalled()

    expect(screen.getAllByRole('button', { name: 'Duplicar refeição' })).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicar refeição' })[0])
    expect(screen.getAllByRole('button', { name: 'Duplicar refeição' })).toHaveLength(4)
  })
})
