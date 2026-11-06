import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeWeekCalendar } from './HomeWeekCalendar'

describe('HomeWeekCalendar — calendário compacto da Home', () => {
  beforeEach(() => {
    // 5/11/2026, quinta, meio-dia em São Paulo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('mostra mês e ano, os dias da semana de segunda a domingo e os números', () => {
    const { container } = render(<HomeWeekCalendar onOpen={vi.fn()} />)

    expect(screen.getByText('Novembro 2026')).toBeInTheDocument()

    const weekdays = [...container.querySelectorAll('.home-week-weekday')].map((e) => e.textContent)
    expect(weekdays).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])

    const numbers = [...container.querySelectorAll('.home-week-day')].map((e) => e.textContent)
    expect(numbers).toEqual(['2', '3', '4', '5', '6', '7', '8'])
  })

  it('destaca só o dia de hoje', () => {
    const { container } = render(<HomeWeekCalendar onOpen={vi.fn()} />)
    const today = container.querySelectorAll('.home-week-day--today')
    expect(today).toHaveLength(1)
    expect(today[0].textContent).toBe('5')
  })

  it('a área inteira abre a agenda (um único botão, sem botão extra)', () => {
    const onOpen = vi.fn()
    render(<HomeWeekCalendar onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agenda/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('as setas trocam de semana e NÃO abrem a agenda', () => {
    const onOpen = vi.fn()
    const { container } = render(<HomeWeekCalendar onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    expect([...container.querySelectorAll('.home-week-day')].map((e) => e.textContent)).toEqual([
      '9', '10', '11', '12', '13', '14', '15',
    ])
    expect(container.querySelector('.home-week-day--today')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect([...container.querySelectorAll('.home-week-day')].map((e) => e.textContent)).toEqual([
      '26', '27', '28', '29', '30', '31', '1',
    ])
    expect(screen.getByText('Outubro · Novembro 2026')).toBeInTheDocument()

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('o rótulo do botão informa a semana mostrada', () => {
    render(<HomeWeekCalendar onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Abrir agenda. Semana de Novembro 2026' })).toBeInTheDocument()
  })
})
