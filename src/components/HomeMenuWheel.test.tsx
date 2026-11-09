import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeMenuWheel } from './HomeMenuWheel'

describe('HomeMenuWheel — menu vertical contínuo', () => {
  afterEach(() => cleanup())

  it('mostra os 4 cards na ordem e cada um abre o seu destino', () => {
    const onNavigate = vi.fn()
    render(<HomeMenuWheel onNavigate={onNavigate} />)
    // A segunda volta da roda é cópia (aria-hidden): só as 4 reais são acessíveis.
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Dicas de leitura',
      'Respiração',
      'Assinaturas',
      'Playlist',
    ])
    buttons.forEach((b) => fireEvent.click(b))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['leitura', 'respiracao', 'planos', 'playlist'])
  })

  it('a profissional não vê Assinaturas', () => {
    render(<HomeMenuWheel onNavigate={vi.fn()} showSubscriptions={false} />)
    expect(screen.queryByRole('button', { name: 'Assinaturas' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
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
    // Respiração, Assinaturas e Playlist seguem com o degradê e o ícone.
    expect(container.querySelectorAll('.wheel-thumb:not(.wheel-thumb--photo) svg')).toHaveLength(6)
  })
})
