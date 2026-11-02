import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenAnnualRing } from './GardenAnnualRing'
import { computeAnnualCycle, computeAnnualMonthsLit } from '../types/gardenEvolution'

describe('GardenAnnualRing', () => {
  afterEach(() => {
    cleanup()
  })

  it('com cycle=null (antes de 2027), mostra a mensagem de início sem acender nenhum marco', () => {
    const { container } = render(<GardenAnnualRing cycle={null} monthsLit={[]} />)
    expect(
      screen.getByRole('img', { name: /ciclo ainda não começou — começa em 1 de janeiro de 2027/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/01\/01\/2027/)).toBeInTheDocument()
    expect(container.querySelectorAll('.garden-annual-ring-mark--lit')).toHaveLength(0)
  })

  it('acende exatamente os meses concluídos do ciclo, nunca mais nem menos', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-01T00:00:00Z'))!
    const monthsLit = computeAnnualMonthsLit(cycle, [
      { period_month: '2027-01-01' },
      { period_month: '2027-02-01' },
      { period_month: '2027-05-01' },
    ])

    const { container } = render(<GardenAnnualRing cycle={cycle} monthsLit={monthsLit} />)

    expect(
      screen.getByRole('img', { name: 'Progressão anual 2027: 3 de 12 meses concluídos' }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('.garden-annual-ring-mark--lit')).toHaveLength(3)
    expect(container.querySelectorAll('.garden-annual-ring-mark')).toHaveLength(12)
  })

  it('com o ciclo cheio, mostra 12 de 12', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-01T00:00:00Z'))!
    const monthsLit = Array(12).fill(true)

    render(<GardenAnnualRing cycle={cycle} monthsLit={monthsLit} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('/ 12 meses')).toBeInTheDocument()
  })
})
