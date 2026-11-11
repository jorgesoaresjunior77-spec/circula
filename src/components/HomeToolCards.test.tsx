import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeToolCards } from './HomeToolCards'

describe('HomeToolCards — Antes de Tudo, Água e IMC', () => {
  afterEach(() => cleanup())

  it('mostra os 3 cards e cada um abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeToolCards onNavigate={onNavigate} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /Antes de Tudo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Água/ }))
    fireEvent.click(screen.getByRole('button', { name: /IMC/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['antes-de-tudo', 'agua', 'imc'])
  })

  it('ícones de ponta a ponta com o título bem pequeno em cima e a xícara no lugar do sol', () => {
    const { container } = render(<HomeToolCards onNavigate={vi.fn()} />)
    expect(container.querySelector('.home-tools--icons')).not.toBeNull()
    expect([...container.querySelectorAll('.home-tool-title')].map((e) => e.textContent)).toEqual(['Antes de Tudo', 'Água', 'IMC'])
    // O título é só visual: o nome acessível do botão continua o mesmo.
    expect(screen.getByRole('button', { name: 'Antes de Tudo' })).toBeInTheDocument()
    expect(container.querySelector('.tool-icon--coffee')).not.toBeNull()
    expect(container.querySelector('.tool-icon--sun')).toBeNull()
  })
})
