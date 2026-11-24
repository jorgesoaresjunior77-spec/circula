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
      'Dicas de Séries / Filmes',
      'Dicas de Viagem',
    ])
    buttons.forEach((b) => fireEvent.click(b))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['leitura', 'respiracao', 'playlist', 'wellness', 'series', 'viagens'])
  })

  it('com foto cadastrada mostra a imagem; sem foto, o ícone de sempre', () => {
    const { container } = render(
      <HomeMenuWheel
        onNavigate={vi.fn()}
        imagePaths={{ menu_leitura: 'https://exemplo.com/leitura.jpg' }}
      />,
    )
    // Só o card de leitura tem foto (a segunda volta é cópia: 2 imagens no total).
    const imgs = container.querySelectorAll('.wheel-thumb--photo img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute('src', 'https://exemplo.com/leitura.jpg')
    // Respiração, Playlist, Wellness, Séries e Viagem seguem com o degradê e o ícone.
    expect(container.querySelectorAll('.wheel-thumb:not(.wheel-thumb--photo) svg')).toHaveLength(10)
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
