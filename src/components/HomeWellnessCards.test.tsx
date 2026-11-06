import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeWellnessCards } from './HomeWellnessCards'

describe('HomeWellnessCards — cards finos de bem-estar', () => {
  afterEach(() => cleanup())

  it('mostra os 4 cards na ordem: ANTES DE TUDO, água, leitura, respiração', () => {
    render(<HomeWellnessCards onNavigate={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0]).toHaveTextContent('ANTES DE TUDO')
    expect(buttons[0]).toHaveTextContent('Pequenos hábitos. Uma vida melhor.')
    expect(buttons[1]).toHaveTextContent('Calculadora de água')
    expect(buttons[2]).toHaveTextContent('Dicas de Leitura')
    expect(buttons[3]).toHaveTextContent('Respiração e Meditação')
  })

  it('cada card abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeWellnessCards onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: /ANTES DE TUDO/ }))
    fireEvent.click(screen.getByRole('button', { name: /Calculadora de água/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dicas de Leitura/ }))
    fireEvent.click(screen.getByRole('button', { name: /Respiração e Meditação/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual([
      'antes-de-tudo',
      'agua',
      'leitura',
      'respiracao',
    ])
  })

  it('só a profissional vê o acesso às mensagens do dia', () => {
    const onNavigate = vi.fn()
    const { rerender } = render(<HomeWellnessCards onNavigate={onNavigate} />)
    expect(screen.queryByRole('button', { name: /Mensagens do dia/ })).not.toBeInTheDocument()

    rerender(<HomeWellnessCards onNavigate={onNavigate} canManageInspirations />)
    fireEvent.click(screen.getByRole('button', { name: /Mensagens do dia/ }))
    expect(onNavigate).toHaveBeenCalledWith('inspiracoes')
  })
})
