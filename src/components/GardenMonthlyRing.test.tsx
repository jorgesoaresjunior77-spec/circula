import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenMonthlyRing } from './GardenMonthlyRing'
import { GARDEN_MONTHLY_ACTIVITIES } from '../types/gardenEvolution'

describe('GardenMonthlyRing', () => {
  afterEach(() => {
    cleanup()
  })

  it('mostra o percentual e os pontos reais no rótulo acessível', () => {
    render(<GardenMonthlyRing points={37} earnedSources={new Set()} />)
    expect(
      screen.getByRole('img', {
        name: /Desafio mensal: 37% concluído, 37 de 100 pontos\. Faltam 63 pontos\./,
      }),
    ).toBeInTheDocument()
  })

  it('nunca passa de 100%, mesmo com pontos acima da meta', () => {
    render(<GardenMonthlyRing points={250} earnedSources={new Set()} />)
    expect(screen.getByRole('img', { name: /100% concluído/ })).toBeInTheDocument()
  })

  it('anuncia a conclusão do mês quando atinge a meta', () => {
    render(<GardenMonthlyRing points={100} earnedSources={new Set()} />)
    expect(screen.getByRole('img', { name: /Mês concluído!/ })).toBeInTheDocument()
  })

  it('renderiza uma bolinha por fonte de pontuação (8 atividades)', () => {
    const { container } = render(<GardenMonthlyRing points={0} earnedSources={new Set()} />)
    const dots = container.querySelectorAll('.garden-monthly-ring-dot')
    expect(dots).toHaveLength(GARDEN_MONTHLY_ACTIVITIES.length)
  })

  it('acende só as bolinhas das fontes realmente ganhas este mês', () => {
    const { container } = render(
      <GardenMonthlyRing points={15} earnedSources={new Set(['post', 'mood_checkin'])} />,
    )
    const dots = Array.from(container.querySelectorAll('.garden-monthly-ring-dot'))
    const filledCount = dots.filter((dot) => dot.getAttribute('stroke-width') === '0').length
    expect(filledCount).toBe(2)
  })
})
