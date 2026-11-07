import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeToolCards } from './HomeToolCards'

describe('HomeToolCards — Calendário, Água e IMC', () => {
  afterEach(() => cleanup())

  it('mostra os 3 cards e cada um abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeToolCards onNavigate={onNavigate} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /Calendário/ }))
    fireEvent.click(screen.getByRole('button', { name: /Água/ }))
    fireEvent.click(screen.getByRole('button', { name: /IMC/ }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['agenda', 'agua', 'imc'])
  })
})
