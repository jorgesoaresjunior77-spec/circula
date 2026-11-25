import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HelpPage } from './HelpPage'

describe('HelpPage · robô e tour', () => {
  afterEach(cleanup)

  it('mostra o robô e o botão "Explicar tour", que chama o callback', () => {
    const onStartTour = vi.fn()
    const { container } = render(<HelpPage onStartTour={onStartTour} />)
    expect(container.querySelector('.robo-guia')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Explicar tour' }))
    expect(onStartTour).toHaveBeenCalledTimes(1)
  })

  it('sem o callback não mostra o botão', () => {
    render(<HelpPage />)
    expect(screen.queryByRole('button', { name: 'Explicar tour' })).not.toBeInTheDocument()
  })

  it('tocar no robô troca para a piscadinha', () => {
    const { container } = render(<HelpPage onStartTour={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cumprimentar a Livi' }))
    expect(container.querySelector('.robo-guia')?.getAttribute('data-cena')).toBe('piscadinha')
  })

  it('tem o botão de mudo', () => {
    render(<HelpPage onStartTour={vi.fn()} />)
    expect(screen.getByRole('button', { name: /som da Livi/ })).toBeInTheDocument()
  })
})
