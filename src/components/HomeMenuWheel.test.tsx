import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeMenuWheel } from './HomeMenuWheel'

describe('HomeMenuWheel — menu vertical contínuo', () => {
  afterEach(() => cleanup())

  it('mostra os 6 cards na ordem e cada um abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeMenuWheel onNavigate={onNavigate} />)
    // A segunda volta da roda é cópia (aria-hidden): só as 6 reais são acessíveis.
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Dicas de leitura',
      'Respiração',
      'Playlist',
      'Wellness',
      'Séries e Filmes',
      'Dicas de Viagem',
    ])
    buttons.forEach((b) => fireEvent.click(b))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['leitura', 'respiracao', 'playlist', 'wellness', 'series', 'viagens'])
  })

  it('só frases: cada card tem um ícone e nenhuma foto', () => {
    const { container } = render(<HomeMenuWheel onNavigate={vi.fn()} />)
    expect(container.querySelectorAll('.wheel-thumb--photo, .wheel-card img')).toHaveLength(0)
    // 6 reais + 6 cópias da segunda volta, cada uma com o seu ícone.
    expect(container.querySelectorAll('.wheel-thumb svg')).toHaveLength(12)
  })

  it('para enquanto há um dedo em cima e volta ao soltar', () => {
    const { container } = render(<HomeMenuWheel onNavigate={vi.fn()} />)
    const viewport = container.querySelector('.wheel-viewport') as HTMLElement
    fireEvent.pointerDown(viewport)
    expect(viewport.className).toContain('wheel-viewport--paused')
    fireEvent.pointerUp(viewport)
    expect(viewport.className).not.toContain('wheel-viewport--paused')
    fireEvent.pointerDown(viewport)
    fireEvent.pointerCancel(viewport)
    expect(viewport.className).not.toContain('wheel-viewport--paused')
  })
  it('o Carro em Dia aparece na posição do Painel e abre a central; desativado, some', () => {
    const settings = { ativo: true, titulo: 'Carro em Dia', subtitulo: '', icone: 'carro', ordem: 1, teaser: '', tempo_resposta: '', lembrete_dias: 3, imagem: null, imagem_alt: null }
    const onNavigate = vi.fn()
    const { rerender } = render(<HomeMenuWheel onNavigate={onNavigate} carro={settings} />)
    const nomes = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nomes[1]).toBe('Carro em Dia')
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(onNavigate).toHaveBeenCalledWith('carro')
    rerender(<HomeMenuWheel onNavigate={onNavigate} carro={{ ...settings, ativo: false }} />)
    expect(screen.queryByText('Carro em Dia')).toBeNull()
  })
})
