import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('começa claro, liga o bege rosé ao tocar e guarda a escolha', () => {
    render(<ThemeToggle />)
    const chave = screen.getByRole('switch')
    expect(chave).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(chave)
    expect(chave).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.theme).toBe('rose')
    expect(localStorage.getItem('circula:tema')).toBe('rose')
    fireEvent.click(chave)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
