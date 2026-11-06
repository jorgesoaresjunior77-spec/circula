import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeWellnessCards } from './HomeWellnessCards'

describe('HomeWellnessCards — cards finos de bem-estar', () => {
  afterEach(() => cleanup())

  it('mostra o card "Calculadora de água" e abre a calculadora', () => {
    const onNavigate = vi.fn()
    render(<HomeWellnessCards onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: /Calculadora de água/ }))
    expect(onNavigate).toHaveBeenCalledWith('agua')
  })
})
