import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeWellnessCards } from './HomeWellnessCards'

describe('HomeWellnessCards — cards finos de bem-estar', () => {
  afterEach(() => cleanup())

  it('mostra os 3 cards na ordem: ANTES DE TUDO, leitura, respiração', () => {
    render(<HomeWellnessCards onNavigate={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveTextContent('ANTES DE TUDO')
    expect(buttons[0]).toHaveTextContent('Pequenos hábitos. Uma vida melhor.')
    expect(buttons[1]).toHaveTextContent('Dicas de Leitura')
    expect(buttons[2]).toHaveTextContent('Respiração e Meditação')
  })

  it('cada card abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeWellnessCards onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: /ANTES DE TUDO/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dicas de Leitura/ }))
    fireEvent.click(screen.getByRole('button', { name: /Respiração e Meditação/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual([
      'antes-de-tudo',
      'leitura',
      'respiracao',
    ])
  })
})
