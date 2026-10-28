import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HomeEditorialCards } from './HomeEditorialCards'
import { formatEventDate } from '../lib/formatEventDate'
import type { CommunityContent } from '../types/content'
import type { Product } from '../types/product'

const RECIPE: CommunityContent = {
  id: 'content-1',
  community_id: 'community-1',
  circle_id: null,
  created_by: 'prof-1',
  type: 'recipe',
  title: 'Panqueca de banana',
  summary: 'Café da manhã rápido e nutritivo.',
  body: null,
  cover_image_url: 'https://example.com/panqueca.jpg',
  external_url: null,
  category: 'Café da manhã',
  status: 'published',
  created_at: '2026-10-20T00:00:00.000Z',
  updated_at: '2026-10-20T00:00:00.000Z',
  author: null,
  likes: [],
}

const PRODUCT: Product = {
  id: 'product-1',
  community_id: 'community-1',
  created_by: 'prof-1',
  type: 'ebook',
  title: 'Guia de receitas',
  description: null,
  cover_image_url: 'https://example.com/ebook.jpg',
  price_cents: 4990,
  currency: 'BRL',
  status: 'published',
  max_quantity: null,
  deliverable_kind: 'file',
  deliverable_url: null,
  deliverable_file_path: null,
  event_starts_at: null,
  event_is_online: null,
  event_location: null,
  requires_shipping: false,
  checkout_url: null,
  created_at: '2026-10-21T00:00:00.000Z',
  updated_at: '2026-10-21T00:00:00.000Z',
}

const NEXT_EVENT = {
  id: 'event-1',
  title: 'Roda de conversa',
  starts_at: '2026-11-02T14:00:00.000Z',
  is_online: true,
}

function baseProps() {
  return {
    receitasCover: null,
    eventosCover: null,
    lojaCover: null,
    nextEvent: null,
    nextEventCover: null,
    recipesCount: 0,
    featuredRecipe: null,
    featuredRecipeCover: null,
    productsCount: 0,
    featuredProduct: null,
    onNavigate: vi.fn(),
  }
}

/** Botão que CONTÉM este texto em algum trecho (o nome acessível do botão é todo o texto dos 3 cards concatenado por item, então localizamos pelo conteúdo, não por name exato). */
function cardButtonWith(text: string): HTMLElement {
  const node = screen.getByText(text)
  const button = node.closest('button')
  if (!button) throw new Error(`Nenhum <button> ancestral para o texto "${text}"`)
  return button
}

describe('HomeEditorialCards — estado vazio (sem item em destaque nenhum)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra o fallback editorial dos 3 cards, sem inventar dado nenhum', () => {
    render(<HomeEditorialCards {...baseProps()} />)

    expect(screen.getByText('Nenhum evento agendado')).toBeInTheDocument()
    expect(screen.getByText('Fique de olho — novos eventos aparecem aqui')).toBeInTheDocument()
    expect(screen.getByText('Receitas da comunidade')).toBeInTheDocument()
    expect(screen.getByText('Em breve, novas receitas por aqui')).toBeInTheDocument()
    expect(screen.getByText('Loja da comunidade')).toBeInTheDocument()
    expect(screen.getByText('Em breve, novos produtos por aqui')).toBeInTheDocument()
  })

  it('não mostra nenhuma tag de tipo (Online/Presencial, categoria, tipo de produto) sem item', () => {
    render(<HomeEditorialCards {...baseProps()} />)

    expect(screen.queryByText('Online')).not.toBeInTheDocument()
    expect(screen.queryByText('Presencial')).not.toBeInTheDocument()
  })

  it('cada card navega para a chave certa ao clicar, mesmo vazio', () => {
    const onNavigate = vi.fn()
    render(<HomeEditorialCards {...baseProps()} onNavigate={onNavigate} />)

    fireEvent.click(cardButtonWith('Nenhum evento agendado'))
    fireEvent.click(cardButtonWith('Receitas da comunidade'))
    fireEvent.click(cardButtonWith('Loja da comunidade'))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'eventos')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'receitas')
    expect(onNavigate).toHaveBeenNthCalledWith(3, 'loja')
  })
})

describe('HomeEditorialCards — evento em destaque (o próximo, via railSummary)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra título, data/horário formatados e a tag "Online"', () => {
    render(<HomeEditorialCards {...baseProps()} nextEvent={NEXT_EVENT} />)

    expect(screen.getByText('Roda de conversa')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText(formatEventDate(NEXT_EVENT.starts_at))).toBeInTheDocument()
  })

  it('mostra "Presencial" quando is_online é false', () => {
    render(<HomeEditorialCards {...baseProps()} nextEvent={{ ...NEXT_EVENT, is_online: false }} />)

    expect(screen.getByText('Presencial')).toBeInTheDocument()
  })

  it('sem is_online informado (null), não mostra nenhuma tag — não inventa o tipo', () => {
    render(<HomeEditorialCards {...baseProps()} nextEvent={{ ...NEXT_EVENT, is_online: null }} />)

    expect(screen.queryByText('Online')).not.toBeInTheDocument()
    expect(screen.queryByText('Presencial')).not.toBeInTheDocument()
  })

  it('a foto do PRÓPRIO evento (nextEventCover) tem prioridade sobre a capa genérica de "Eventos"', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        nextEvent={NEXT_EVENT}
        nextEventCover="https://example.com/evento-proprio.jpg"
        eventosCover="https://example.com/capa-generica.jpg"
      />,
    )

    const img = cardButtonWith('Roda de conversa').querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/evento-proprio.jpg')
  })

  it('sem foto própria, cai para a capa genérica de "Eventos"', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        nextEvent={NEXT_EVENT}
        nextEventCover={null}
        eventosCover="https://example.com/capa-generica.jpg"
      />,
    )

    const img = cardButtonWith('Roda de conversa').querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/capa-generica.jpg')
  })

  it('navega para "eventos" ao clicar no card com evento', () => {
    const onNavigate = vi.fn()
    render(<HomeEditorialCards {...baseProps()} nextEvent={NEXT_EVENT} onNavigate={onNavigate} />)

    fireEvent.click(cardButtonWith('Roda de conversa'))

    expect(onNavigate).toHaveBeenCalledWith('eventos')
  })
})

describe('HomeEditorialCards — receita em destaque (a mais recente publicada)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra título, descrição (summary) e a categoria como tag', () => {
    render(<HomeEditorialCards {...baseProps()} featuredRecipe={RECIPE} recipesCount={1} />)

    expect(screen.getByText('Panqueca de banana')).toBeInTheDocument()
    expect(screen.getByText('Café da manhã rápido e nutritivo.')).toBeInTheDocument()
    expect(screen.getByText('Café da manhã')).toBeInTheDocument()
  })

  it('sem summary, não mostra subtítulo nenhum (nunca um texto inventado)', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        featuredRecipe={{ ...RECIPE, summary: null }}
        recipesCount={1}
      />,
    )

    expect(screen.queryByText('Café da manhã rápido e nutritivo.')).not.toBeInTheDocument()
  })

  it('com só 1 receita publicada, não mostra nota de "outras receitas"', () => {
    render(<HomeEditorialCards {...baseProps()} featuredRecipe={RECIPE} recipesCount={1} />)

    expect(screen.queryByText(/outra receita/)).not.toBeInTheDocument()
  })

  it('com mais de 1 receita publicada, mostra "+N outras receitas" (plural)', () => {
    render(<HomeEditorialCards {...baseProps()} featuredRecipe={RECIPE} recipesCount={3} />)

    expect(screen.getByText('+2 outras receitas')).toBeInTheDocument()
  })

  it('com exatamente 2 receitas publicadas, usa o singular "+1 outra receita"', () => {
    render(<HomeEditorialCards {...baseProps()} featuredRecipe={RECIPE} recipesCount={2} />)

    expect(screen.getByText('+1 outra receita')).toBeInTheDocument()
  })

  it('a foto da PRÓPRIA receita tem prioridade sobre a capa genérica de "Receitas"', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        featuredRecipe={RECIPE}
        featuredRecipeCover="https://example.com/receita-propria.jpg"
        receitasCover="https://example.com/capa-generica.jpg"
      />,
    )

    const img = cardButtonWith('Panqueca de banana').querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/receita-propria.jpg')
  })

  it('navega para "receitas" ao clicar no card com receita', () => {
    const onNavigate = vi.fn()
    render(<HomeEditorialCards {...baseProps()} featuredRecipe={RECIPE} onNavigate={onNavigate} />)

    fireEvent.click(cardButtonWith('Panqueca de banana'))

    expect(onNavigate).toHaveBeenCalledWith('receitas')
  })
})

describe('HomeEditorialCards — produto em destaque (o mais recente publicado)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra título, preço formatado (BRL) e o tipo do produto como tag', () => {
    render(<HomeEditorialCards {...baseProps()} featuredProduct={PRODUCT} productsCount={1} />)

    expect(screen.getByText('Guia de receitas')).toBeInTheDocument()
    expect(screen.getByText('E-book')).toBeInTheDocument()
    expect(screen.getByText('R$ 49,90')).toBeInTheDocument()
  })

  it('com mais de 1 produto publicado, mostra "+N outros produtos"', () => {
    render(<HomeEditorialCards {...baseProps()} featuredProduct={PRODUCT} productsCount={4} />)

    expect(screen.getByText('+3 outros produtos')).toBeInTheDocument()
  })

  it('a foto do PRÓPRIO produto (sem assinatura, mesma convenção de ProductCard) tem prioridade sobre a capa genérica de "Loja"', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        featuredProduct={PRODUCT}
        lojaCover="https://example.com/capa-generica.jpg"
      />,
    )

    const img = cardButtonWith('Guia de receitas').querySelector('img')
    expect(img).toHaveAttribute('src', PRODUCT.cover_image_url)
  })

  it('navega para "loja" ao clicar no card com produto', () => {
    const onNavigate = vi.fn()
    render(<HomeEditorialCards {...baseProps()} featuredProduct={PRODUCT} onNavigate={onNavigate} />)

    fireEvent.click(cardButtonWith('Guia de receitas'))

    expect(onNavigate).toHaveBeenCalledWith('loja')
  })
})

describe('HomeEditorialCards — acessibilidade e estrutura (sem texto sobreposto à foto)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('a seção tem um rótulo acessível e os 3 cards são botões', () => {
    render(<HomeEditorialCards {...baseProps()} />)

    expect(screen.getByRole('region', { name: 'Receitas, eventos e loja da comunidade' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('a imagem é decorativa (alt vazio) — o texto ao lado já descreve o item', () => {
    render(
      <HomeEditorialCards
        {...baseProps()}
        nextEvent={NEXT_EVENT}
        nextEventCover="https://example.com/evento-proprio.jpg"
      />,
    )

    const img = cardButtonWith('Roda de conversa').querySelector('img')
    expect(img).toHaveAttribute('alt', '')
  })
})
