import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Tour } from './Tour'

// Cria os elementos reais que o Tour procura por id (tour-nav-desktop-*,
// tour-nav-mobile-*, tour-notification-bell) — simula o layout real do
// app sem montar PrimaryNav/NotificationBell inteiros. `offsetParent`
// não existe em jsdom por padrão (sempre null) — sobrescrito aqui para
// simular "visível" no layout desktop.
function mountFakeNav() {
  document.body.innerHTML = `
    <button id="tour-nav-desktop-inicio">Início</button>
    <button id="tour-nav-desktop-circulos">Círculos</button>
    <button id="tour-nav-desktop-feed">Feed</button>
    <button id="tour-nav-desktop-jardim">Meu Jardim</button>
    <button id="tour-nav-desktop-perfil">Perfil</button>
    <button id="tour-notification-bell">Sino</button>
  `
  for (const el of document.querySelectorAll('button')) {
    Object.defineProperty(el, 'offsetParent', { get: () => document.body })
    el.getBoundingClientRect = () =>
      ({ top: 10, left: 10, width: 40, height: 40, right: 50, bottom: 50, x: 10, y: 10, toJSON() {} }) as DOMRect
  }
}

describe('Tour', () => {
  beforeEach(() => {
    mountFakeNav()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('navega para o destino real de cada passo que tem navKey', () => {
    const onNavigate = vi.fn()
    render(<Tour onNavigate={onNavigate} onDone={vi.fn()} />)
    expect(onNavigate).toHaveBeenCalledWith('inicio')
  })

  it('avança pelos passos na ordem, navegando a cada um', () => {
    const onNavigate = vi.fn()
    render(<Tour onNavigate={onNavigate} onDone={vi.fn()} />)

    expect(screen.getByText('Página inicial')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Avançar'))
    expect(document.querySelector('.tour-card-title')).toHaveTextContent('Círculos')
    expect(onNavigate).toHaveBeenLastCalledWith('circulos')

    fireEvent.click(screen.getByText('Avançar'))
    expect(screen.getByText('Como participar de um círculo')).toBeInTheDocument()
  })

  it('"Voltar" funciona e não aparece no primeiro passo', () => {
    render(<Tour onNavigate={vi.fn()} onDone={vi.fn()} />)
    expect(screen.queryByText('Voltar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Avançar'))
    expect(screen.getByText('Voltar')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Voltar'))
    expect(screen.getByText('Página inicial')).toBeInTheDocument()
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

    // 7 passos ao todo (índices 0-6) — 6 cliques em "Avançar" chegam ao último.
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Avançar'))
    }

    expect(screen.getByText('Notificações')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Encerrar'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
