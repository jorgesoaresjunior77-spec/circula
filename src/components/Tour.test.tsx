import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Tour, TOUR_STEPS } from './Tour'

// Cria alguns dos elementos reais que o Tour procura (atalhos, sino, botões
// da barra). `offsetParent` não existe em jsdom por padrão (sempre null) —
// sobrescrito aqui para simular "visível".
function mountFakeHome() {
  document.body.innerHTML = `
    <header class="home-greeting">Bom dia</header>
    <section class="home-tools">Atalhos</section>
    <button id="tour-nav-mobile-feed">Feed</button>
    <button id="tour-nav-mobile-perfil">Perfil</button>
    <button id="tour-notification-bell">Sino</button>
  `
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    Object.defineProperty(el, 'offsetParent', { get: () => document.body })
    el.getBoundingClientRect = () =>
      ({ top: 10, left: 10, width: 40, height: 40, right: 50, bottom: 50, x: 10, y: 10, toJSON() {} }) as DOMRect
    el.scrollIntoView = () => {}
  }
}

describe('Tour', () => {
  beforeEach(() => {
    mountFakeHome()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('acontece na página inicial: navega para o Início uma vez, ao abrir', () => {
    const onNavigate = vi.fn()
    render(<Tour onNavigate={onNavigate} onDone={vi.fn()} />)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('inicio')

    fireEvent.click(screen.getByText('Avançar'))
    expect(onNavigate).toHaveBeenCalledTimes(1) // não sai da página inicial
  })

  it('avança pelos passos na ordem', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)

    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Página inicial')
    fireEvent.click(screen.getByText('Avançar'))
    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Atalhos do dia')
    fireEvent.click(screen.getByText('Avançar'))
    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Menu')
  })

  it('mostra o contador de passos', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeInTheDocument()
  })

  it('um passo cujo alvo não existe na tela não trava: o balão aparece sem destaque', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)
    fireEvent.click(screen.getByText('Avançar'))
    fireEvent.click(screen.getByText('Avançar')) // "Menu": .exp-strip não foi montado
    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Menu')
    expect(document.querySelector('.tour-spotlight')).toBeNull()
    expect(document.querySelector('.tour-overlay-dim')).not.toBeNull()
  })

  it('"Voltar" funciona e não aparece no primeiro passo', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)
    expect(screen.queryByText('Voltar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Avançar'))
    expect(screen.getByText('Voltar')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Voltar'))
    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Página inicial')
  })

  it('"Pular tour" encerra imediatamente, de qualquer passo', () => {
    const onDone = vi.fn()
    render(<Tour onNavigate={vi.fn()} onDone={onDone} />)
    fireEvent.click(screen.getByText('Pular tour'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('o último passo mostra "Encerrar" em vez de "Avançar", e conclui ao clicar', () => {
    const onDone = vi.fn()
    render(<Tour onNavigate={vi.fn()} onDone={onDone} />)

    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByText('Avançar'))
    }

    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Notificações')
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Encerrar'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
