import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeWellnessCards } from './HomeWellnessCards'

describe('HomeWellnessCards — cards finos de bem-estar', () => {
  afterEach(() => cleanup())

  it('mostra ANTES DE TUDO primeiro e depois a Calculadora de água', () => {
    render(<HomeWellnessCards onNavigate={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('ANTES DE TUDO')
    expect(buttons[0]).toHaveTextContent('Pequenos hábitos. Uma vida melhor.')
    expect(buttons[1]).toHaveTextContent('Calculadora de água')
  })

  it('cada card abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeWellnessCards onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: /ANTES DE TUDO/ }))
    fireEvent.click(screen.getByRole('button', { name: /Calculadora de água/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['antes-de-tudo', 'agua'])
  })
})
