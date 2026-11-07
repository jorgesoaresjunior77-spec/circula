import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeSubscriptionCard } from './HomeSubscriptionCard'

describe('HomeSubscriptionCard — assinaturas e conteúdos', () => {
  afterEach(() => cleanup())

  it('mostra o título e abre os Planos', () => {
    const onNavigate = vi.fn()
    render(<HomeSubscriptionCard onNavigate={onNavigate} />)

    const card = screen.getByRole('button', { name: /Assinaturas e conteúdos/ })
    expect(card).toHaveTextContent('Planos, conteúdos e pacotes')
    fireEvent.click(card)
    expect(onNavigate).toHaveBeenCalledWith('planos')
  })

  it('usa a capa da Loja quando existe e funciona sem ela', () => {
    const { container, rerender } = render(<HomeSubscriptionCard onNavigate={vi.fn()} />)
    expect(container.querySelector('img')).toBeNull()

    rerender(<HomeSubscriptionCard cover="https://img.test/loja.jpg" onNavigate={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/loja.jpg')
  })
})
