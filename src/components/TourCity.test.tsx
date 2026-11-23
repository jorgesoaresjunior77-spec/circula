import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Tour, TOUR_STEPS, cityTourSeen, markCityTourSeen } from './Tour'

describe('Tour · passo "Na minha cidade"', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section class="circ-strip">Círculos</section><div class="home-city-card">Cidade</div>'
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      Object.defineProperty(el, 'offsetParent', { get: () => document.body })
      el.getBoundingClientRect = () => ({ top: 10, left: 10, width: 40, height: 40, right: 50, bottom: 50, x: 10, y: 10, toJSON() {} }) as DOMRect
      el.scrollIntoView = () => {}
    }
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('vem logo depois do passo dos Círculos', () => {
    const titles = TOUR_STEPS.map((s) => s.title)
    expect(titles.indexOf('Na minha cidade')).toBe(titles.indexOf('Círculos') + 1)
  })

  it('quem já fez o tour vê só a novidade, com selo "Novo", e depois ela não volta', () => {
    expect(cityTourSeen()).toBe(false)
    const onDone = vi.fn()
    render(<Tour onNavigate={vi.fn()} onDone={onDone} noveltyOnly />)
    expect(screen.getByText('Na minha cidade')).toBeTruthy()
    expect(screen.getByText(/Novo/)).toBeTruthy()
    expect(screen.getByText(/de restaurantes a eletricistas/)).toBeTruthy()
    fireEvent.click(screen.getByText('Entendi'))
    expect(onDone).toHaveBeenCalled()
    markCityTourSeen()
    expect(cityTourSeen()).toBe(true)
  })

  it('no tour completo o botão deste passo é "Próximo"', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)
    // avança até o passo da cidade: Círculos vem antes dele nesta página de teste
    for (let i = 0; i < 12 && !screen.queryByText(/de restaurantes a eletricistas/); i++) {
      fireEvent.click(screen.getByText(/Avançar|Próximo/))
    }
    expect(screen.getByText('Próximo')).toBeTruthy()
  })
})
