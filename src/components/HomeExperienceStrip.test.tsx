import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HomeExperienceStrip } from './HomeExperienceStrip'

/**
 * `useDragCarousel` (ver hooks/useDragCarousel.ts) mede layout real via
 * ResizeObserver para decidir se liga o ciclo infinito — inexistente no
 * jsdom por padrão. Com getBoundingClientRect() zerado (padrão do
 * jsdom), o ciclo nunca liga nestes testes de qualquer forma (mesmo
 * ramo "cabe tudo na tela" do hook) — o stub só evita o construtor
 * lançar `ResizeObserver is not defined`.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('HomeExperienceStrip — Item 2: acesso ao Meu Jardim pela Home', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('mostra um card "Meu Jardim" entre os destinos fixos da faixa', () => {
    render(<HomeExperienceStrip nextEvent={null} onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Meu Jardim' })).toBeInTheDocument()
  })

  it('navega para "jardim" ao clicar, chamando onNavigate uma única vez com a chave certa', () => {
    const onNavigate = vi.fn()
    render(<HomeExperienceStrip nextEvent={null} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Meu Jardim' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('jardim')
  })

  it('não duplica o card "Meu Jardim" nem nenhum dos outros 5 destinos fixos', () => {
    render(<HomeExperienceStrip nextEvent={null} onNavigate={vi.fn()} />)

    for (const name of ['Meu Perfil', 'Help Nutri — fale com a nutricionista', 'Eventos', 'Loja', 'Receitas', 'Meu Jardim']) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1)
    }
  })

  it('nasce sem foto (fallback editorial), diferente dos cards que recebem capa configurada', () => {
    render(
      <HomeExperienceStrip
        nextEvent={null}
        perfilCover="https://example.com/perfil.jpg"
        onNavigate={vi.fn()}
      />,
    )

    const jardimCard = screen.getByRole('button', { name: 'Meu Jardim' })
    expect(jardimCard.querySelector('img')).not.toBeInTheDocument()

    const perfilCard = screen.getByRole('button', { name: 'Meu Perfil' })
    expect(perfilCard.querySelector('img')).toBeInTheDocument()
  })
})
