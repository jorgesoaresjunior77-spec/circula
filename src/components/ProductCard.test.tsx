import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import type { Product } from '../types/product'

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    community_id: 'c1',
    created_by: 'u1',
    type: 'ebook',
    title: 'Guia de lanches',
    description: null,
    cover_image_url: null,
    price_cents: 2990,
    currency: 'BRL',
    status: 'published',
    max_quantity: null,
    deliverable_kind: 'none',
    deliverable_url: null,
    deliverable_file_path: null,
    event_starts_at: null,
    event_is_online: null,
    event_location: null,
    requires_shipping: false,
    checkout_url: 'https://pay.hotmart.com/abc',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...patch,
  }
}

afterEach(cleanup)

describe('ProductCard — produtos digitais pelo plano', () => {
  it('e-book sem o plano: mostra o preço, o Comprar e a dica do plano; nada de Hotmart', () => {
    const onOpenPlans = vi.fn()
    const onBuy = vi.fn().mockResolvedValue({ error: null, invoiceUrl: null })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProductCard product={product()} canBuy onBuy={onBuy} onOpenPlans={onOpenPlans} />)

    expect(screen.getByText(/29,90/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument()
    expect(screen.getByText(/pacote de E-books ou o plano completo/)).toBeInTheDocument()
    expect(screen.queryByText(/Hotmart/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ler agora' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver planos' }))
    expect(onOpenPlans).toHaveBeenCalledTimes(1)
    // o link antigo da Hotmart nunca é aberto
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('quem tem o pacote lê dentro do Círcula: botão "Ler agora", sem cadeado nem preço', () => {
    const onRead = vi.fn()
    render(<ProductCard product={product()} canBuy canRead onRead={onRead} onOpenPlans={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Ver planos' })).not.toBeInTheDocument()
    expect(screen.queryByText(/29,90/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ler agora' }))
    expect(onRead).toHaveBeenCalledTimes(1)
  })

  it('e-book já adquirido antes também pode ser lido', () => {
    render(<ProductCard product={product()} canBuy owned onOpenPlans={() => {}} />)
    expect(screen.getByRole('button', { name: 'Ler agora' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver planos' })).not.toBeInTheDocument()
  })

  it('produto não digital segue com a compra de sempre', () => {
    render(<ProductCard product={product({ type: 'consultation' })} canBuy onBuy={vi.fn()} onOpenPlans={() => {}} />)
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument()
    expect(screen.getByText(/29,90/)).toBeInTheDocument()
  })

  it('na gestão (sem compra) mostra o preço e nenhum cadeado', () => {
    render(<ProductCard product={product()} />)
    expect(screen.getByText(/29,90/)).toBeInTheDocument()
    expect(screen.queryByText(/plano completo/)).not.toBeInTheDocument()
  })
})
