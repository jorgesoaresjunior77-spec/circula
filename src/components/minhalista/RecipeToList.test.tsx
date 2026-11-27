import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecipeToList } from './RecipeToList'
import type { Recipe } from '../../hooks/useRecipes'
import type { useShopping } from '../../hooks/useShopping'

afterEach(cleanup)

const recipe = (id: string, title: string, ingredients: string): Recipe => ({
  id, title, summary: null, ingredients, body: null, cover_image_url: null, category_id: null, status: 'published', created_at: '',
})

function fakeApi() {
  const createList = vi.fn().mockResolvedValue({ error: null, id: 'nova-1' })
  const importDrafts = vi.fn().mockResolvedValue({ error: null, added: 1, merged: 0 })
  const api = { lists: [{ id: 'l1', name: 'Semana', status: 'em_andamento' }], createList, importDrafts } as unknown as ReturnType<typeof useShopping>
  return { api, createList, importDrafts }
}

const r1 = recipe('r1', 'Omelete', '2 ovos\n1 tomate\n200 g de frango')
const r2 = recipe('r2', 'Salada', '3 ovos\n2 tomates')

describe('Montar lista com minhas receitas', () => {
  it('consolida os ingredientes repetidos e cria a lista com o que foi marcado', async () => {
    const { api, createList } = fakeApi()
    const onDone = vi.fn()
    render(<RecipeToList recipes={[r1, r2]} api={api} onClose={() => {}} onDone={onDone} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Omelete' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Salada' }))

    expect(screen.getByText(/5 un/)).toBeInTheDocument() // 2 + 3 ovos
    expect(screen.getByText(/3 un/)).toBeInTheDocument() // 1 + 2 tomates
    expect(screen.getByText(/200 g/)).toBeInTheDocument()

    // desmarca o frango e cria
    fireEvent.click(screen.getByRole('checkbox', { name: /frango/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar lista' }))
    await vi.waitFor(() => expect(createList).toHaveBeenCalled())

    const drafts = createList.mock.calls[0][1] as { name: string; quantity: number }[]
    expect(drafts.map((d) => d.name).sort()).toEqual(['ovos', 'tomate'])
    expect(drafts.find((d) => d.name === 'ovos')?.quantity).toBe(5)
    expect(createList.mock.calls[0][0]).toMatchObject({ source: 'receitas' })
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('nova-1'))
  })

  it('ajustar as porções multiplica as quantidades, sem tocar na receita', () => {
    const { api } = fakeApi()
    render(<RecipeToList recipes={[r1]} fixed={r1} api={api} onClose={() => {}} onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Porções/), { target: { value: '2' } })
    expect(screen.getByText(/4 un/)).toBeInTheDocument()
    expect(r1.ingredients).toBe('2 ovos\n1 tomate\n200 g de frango')
  })

  it('o campo de porções pode ser apagado e aceita qualquer inteiro (ex.: 10)', () => {
    const { api } = fakeApi()
    render(<RecipeToList recipes={[r1]} fixed={r1} api={api} onClose={() => {}} onDone={() => {}} />)
    const input = screen.getByLabelText(/Porções/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('') // apagou o 1 de verdade
    expect(screen.getByText(/2 un/)).toBeInTheDocument() // enquanto vazio, mantém o último cálculo
    fireEvent.change(input, { target: { value: '10' } })
    expect(input.value).toBe('10')
    expect(screen.getByText(/20 un/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '2,5' } })
    expect(input.value).toBe('25') // só dígitos
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input.value).toBe('25') // vazio ao sair volta ao último valor válido
  })

  it('avisa que a revisão dos itens vem na próxima etapa', () => {
    const { api } = fakeApi()
    render(<RecipeToList recipes={[r1]} fixed={r1} api={api} onClose={() => {}} onDone={() => {}} />)
    expect(screen.getByText('Na próxima etapa, você poderá revisar, adicionar ou remover itens da sua lista de compras.')).toBeInTheDocument()
  })

  it('receita sem ingredientes escritos avisa e não deixa criar lista vazia', () => {
    const { api } = fakeApi()
    render(<RecipeToList recipes={[recipe('r3', 'Vazia', '')]} api={api} onClose={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vazia' }))
    expect(screen.getByText(/ainda não tem os ingredientes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar lista' })).toBeDisabled()
  })

  it('para uma lista que já existe, usa a importação que soma o que é compatível', async () => {
    const { api, importDrafts } = fakeApi()
    render(<RecipeToList recipes={[r1]} fixed={r1} api={api} onClose={() => {}} onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText('Colocar em'), { target: { value: 'l1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à lista' }))
    await vi.waitFor(() => expect(importDrafts).toHaveBeenCalled())
    expect(importDrafts.mock.calls[0][0]).toBe('l1')
  })
})
