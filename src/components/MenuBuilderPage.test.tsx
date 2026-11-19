import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MenuBuilderPage } from './MenuBuilderPage'
import type { MenuRecipe } from '../lib/menuBuilder'

const printDocument = vi.fn((_html: string) => true)
vi.mock('../lib/nutriPrint', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/nutriPrint')>()), printDocument: (h: string) => printDocument(h) }))
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
    printDocument.mockClear()
    library = RECIPES
  })

  it('mostra o texto de abertura e o progresso em 5 etapas', () => {
    render(<MenuBuilderPage communityId="c1" />)
    expect(screen.getByText('Vamos preparar algo especial?')).toBeInTheDocument()
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument()
  })

  it('exige a quantidade de pessoas e ao menos uma etapa do cardápio', () => {
    render(<MenuBuilderPage communityId="c1" />)
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

  it('monta o cardápio, ajusta as quantidades e gera o PDF da lista', () => {
    render(<MenuBuilderPage communityId="c1" />)
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

    fireEvent.click(screen.getByRole('button', { name: /salve sua lista de compras/i }))
    expect(printDocument).toHaveBeenCalledTimes(1)
    const html = (printDocument.mock.calls[0] as unknown as [string])[0]
    expect(html).toContain('Lista de compras')
    expect(html).toContain('Jantar de sábado')
    expect(html).toContain('arroz')
  })

  it('sem receitas com ficha, informa a falta em vez de inventar', () => {
    library = []
    render(<MenuBuilderPage communityId="c1" />)
    next()
    next()
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: /montar meu cardápio/i }))
    expect(screen.getByText('Ainda não deu para montar')).toBeInTheDocument()
    expect(screen.getAllByText(/ainda não tem receitas/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /salve sua lista/i })).not.toBeInTheDocument()
  })

  it('voltar não perde o que foi preenchido', () => {
    render(<MenuBuilderPage communityId="c1" />)
    fireEvent.change(screen.getByLabelText(/nome do encontro/i), { target: { value: 'Almoço' } })
    next()
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }))
    expect(screen.getByLabelText(/nome do encontro/i)).toHaveValue('Almoço')
  })
})
