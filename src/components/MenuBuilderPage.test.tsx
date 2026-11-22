import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MenuBuilderPage } from './MenuBuilderPage'
import type { MenuRecipe } from '../lib/menuBuilder'

const createList = vi.fn(async (..._args: unknown[]) => ({ error: null as string | null, id: 'l1' }))
vi.mock('../hooks/useShopping', () => ({ useShopping: () => ({ loading: false, lists: [], createList }) }))
vi.mock('../hooks/useSignedImageUrl', () => ({ useSignedImageUrl: () => ({ url: null }) }))

const RECIPES: MenuRecipe[] = [
  {
    id: 'r1',
    title: 'Risoto de cogumelos',
    summary: 'Cremoso.',
    ingredients: '300 g de arroz\n200 g de cogumelos',
    body: '1. Refogue\n2. Cozinhe',
    cover_image_url: null,
    status: 'published',
    meta: { course: 'prato_principal', cuisines: ['italiana'], diets: [], allergens: [], allergens_verified: true, prep_minutes: 40, difficulty: 'facil', servings: 4, est_cost_cents: null },
  },
  {
    id: 'r2',
    title: 'Pudim',
    summary: null,
    ingredients: '3 ovos',
    body: 'Asse.',
    cover_image_url: null,
    status: 'published',
    meta: { course: 'sobremesa', cuisines: [], diets: [], allergens: ['ovo'], allergens_verified: true, prep_minutes: 60, difficulty: 'facil', servings: 4, est_cost_cents: null },
  },
]

let library: MenuRecipe[] = RECIPES
vi.mock('../hooks/useMenuLibrary', () => ({
  useMenuLibrary: () => ({ recipes: library, loading: false, error: null }),
}))

const next = () => fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }))

describe('MenuBuilderPage', () => {
  afterEach(() => {
    cleanup()
    createList.mockClear()
    library = RECIPES
  })

  it('mostra o texto de abertura e o progresso em 5 etapas', () => {
    render(<MenuBuilderPage communityId="c1" profileId="p1" />)
    expect(screen.getByText('Vamos preparar algo especial?')).toBeInTheDocument()
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument()
  })

  it('exige a quantidade de pessoas e ao menos uma etapa do cardápio', () => {
    render(<MenuBuilderPage communityId="c1" profileId="p1" />)
    fireEvent.change(screen.getByLabelText(/quantidade de pessoas/i), { target: { value: '' } })
    next()
    expect(screen.getByRole('alert')).toHaveTextContent(/quantas pessoas/i)
    fireEvent.change(screen.getByLabelText(/quantidade de pessoas/i), { target: { value: '6' } })
    next()
    // etapa 2: desmarca tudo
    for (const b of screen.getAllByRole('button', { pressed: true })) fireEvent.click(b)
    next()
    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos uma etapa/i)
  })

  it('monta o cardápio, ajusta as quantidades e leva a lista para as Listas de Compras', async () => {
    render(<MenuBuilderPage communityId="c1" profileId="p1" />)
    fireEvent.change(screen.getByLabelText(/nome do encontro/i), { target: { value: 'Jantar de sábado' } })
    fireEvent.change(screen.getByLabelText(/quantidade de pessoas/i), { target: { value: '8' } })
    next() // -> o que servir
    next() // -> estilo
    next() // -> restrições
    next() // -> personalize
    fireEvent.click(screen.getByRole('button', { name: /montar meu cardápio/i }))

    expect(screen.getByText('Seu cardápio está pronto!')).toBeInTheDocument()
    expect(screen.getByText('Risoto de cogumelos')).toBeInTheDocument()
    expect(screen.getByText('Pudim')).toBeInTheDocument()
    // 8 pessoas / rende 4 = dobro
    expect(screen.getByText(/600 g · arroz/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^lista de compras$/i }))
    expect(screen.getByText('Levar o cardápio para a lista de compras')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^criar lista$/i }))
    await waitFor(() => expect(createList).toHaveBeenCalledTimes(1))
    const drafts = createList.mock.calls[0][1] as { name: string }[]
    expect(drafts.map((d) => d.name).join(' ')).toContain('arroz')
    expect(await screen.findByText('Lista salva!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vá para lista de compras já/i })).toBeInTheDocument()
  })

  it('sem receitas com ficha, informa a falta em vez de inventar', () => {
    library = []
    render(<MenuBuilderPage communityId="c1" profileId="p1" />)
    next()
    next()
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: /montar meu cardápio/i }))
    expect(screen.getByText('Ainda não deu para montar')).toBeInTheDocument()
    expect(screen.getAllByText(/ainda não tem receitas/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^lista de compras$/i })).not.toBeInTheDocument()
  })

  it('voltar não perde o que foi preenchido', () => {
    render(<MenuBuilderPage communityId="c1" profileId="p1" />)
    fireEvent.change(screen.getByLabelText(/nome do encontro/i), { target: { value: 'Almoço' } })
    next()
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }))
    expect(screen.getByLabelText(/nome do encontro/i)).toHaveValue('Almoço')
  })
})
