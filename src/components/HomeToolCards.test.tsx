import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeToolCards } from './HomeToolCards'

describe('HomeToolCards — Antes de Tudo, Água, IMC e Calculadora', () => {
  afterEach(() => cleanup())

  it('mostra os 4 cards; três abrem o destino e a Calculadora abre o pop-up na própria tela', () => {
    const onNavigate = vi.fn()
    render(<HomeToolCards onNavigate={onNavigate} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /Antes de Tudo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Água/ }))
    fireEvent.click(screen.getByRole('button', { name: /IMC/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['antes-de-tudo', 'agua', 'imc'])
    expect(screen.queryByRole('dialog', { name: 'Calculadora' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Calculadora' }))
    expect(screen.getByRole('dialog', { name: 'Calculadora' })).toBeInTheDocument()
    expect(onNavigate).toHaveBeenCalledTimes(3)
  })

  it('ícones de ponta a ponta com o título bem pequeno em cima e a xícara no lugar do sol', () => {
    const { container } = render(<HomeToolCards onNavigate={vi.fn()} />)
    expect(container.querySelector('.home-tools--icons')).not.toBeNull()
    expect([...container.querySelectorAll('.home-tool-title')].map((e) => e.textContent)).toEqual(['Antes de Tudo', 'Água', 'IMC', 'Calculadora'])
    // O título é só visual: o nome acessível do botão continua o mesmo.
    expect(screen.getByRole('button', { name: 'Antes de Tudo' })).toBeInTheDocument()
    expect(container.querySelector('.tool-icon--coffee')).not.toBeNull()
    expect(container.querySelector('.tool-icon--sun')).toBeNull()
  })
})
