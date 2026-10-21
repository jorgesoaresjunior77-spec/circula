import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenProgressWheel } from './GardenProgressWheel'

/**
 * Componente puro (sem Supabase, sem hook) — só matemática de
 * completed/total -> percentual + texto acessível. Cobre a matriz do
 * item 4 da auditoria: 0/10, 4/10, 10/10, total zero, e os casos de
 * borda que uma origem de dados (ao vivo OU snapshot congelado) pode
 * legitimamente produzir.
 */
describe('GardenProgressWheel', () => {
  afterEach(() => {
    cleanup()
  })

  it.each([
    { completed: 0, total: 10, percent: 0 },
    { completed: 4, total: 10, percent: 40 },
    { completed: 10, total: 10, percent: 100 },
    { completed: 3, total: 7, percent: 43 }, // arredondamento (42.85...% -> 43%)
  ])('completed=$completed, total=$total -> $percent%, texto e aria-label coerentes', ({ completed, total, percent }) => {
    const { container } = render(<GardenProgressWheel completed={completed} total={total} />)

    expect(
      screen.getByRole('img', {
        name: `Progresso do desafio: ${percent}%, ${completed} de ${total} dias concluídos`,
      }),
    ).toBeInTheDocument()

    const centerValue = container.querySelector('.garden-wheel-center strong')
    expect(centerValue?.textContent).toBe(String(percent))
  })

  it('com total zero, fica em 0% e o aria-label avisa que o progresso está indisponível (nunca "0 de 0")', () => {
    render(<GardenProgressWheel completed={0} total={0} />)

    expect(screen.getByRole('img', { name: 'Progresso do desafio indisponível' })).toBeInTheDocument()
    expect(screen.queryByText(/dias concluídos/)).not.toBeInTheDocument()
  })

  it('nunca ultrapassa 100%, mesmo que completed > total (dado histórico inconsistente)', () => {
    render(<GardenProgressWheel completed={12} total={10} />)

    expect(
      screen.getByRole('img', { name: 'Progresso do desafio: 100%, 12 de 10 dias concluídos' }),
    ).toBeInTheDocument()
  })

  it('nunca fica negativo, mesmo que completed venha negativo', () => {
    render(<GardenProgressWheel completed={-3} total={10} />)

    expect(
      screen.getByRole('img', { name: 'Progresso do desafio: 0%, 0 de 10 dias concluídos' }),
    ).toBeInTheDocument()
  })

  it('usa as cores recebidas por prop (snapshot OU ao vivo — o componente não escolhe a origem)', () => {
    const { container } = render(
      <GardenProgressWheel completed={5} total={10} colorOne="#111111" colorTwo="#222222" />,
    )

    const stops = container.querySelectorAll('stop')
    expect(stops).toHaveLength(2)
    expect(stops[0]).toHaveAttribute('stop-color', '#111111')
    expect(stops[1]).toHaveAttribute('stop-color', '#222222')
  })

  it('sem colorTwo, repete colorOne no segundo stop (gradiente de uma cor só)', () => {
    const { container } = render(<GardenProgressWheel completed={5} total={10} colorOne="#111111" />)

    const stops = container.querySelectorAll('stop')
    expect(stops[0]).toHaveAttribute('stop-color', '#111111')
    expect(stops[1]).toHaveAttribute('stop-color', '#111111')
  })

  it('sem cor nenhuma, cai no acento padrão do app (nunca fica sem cor)', () => {
    const { container } = render(<GardenProgressWheel completed={5} total={10} />)

    const stops = container.querySelectorAll('stop')
    expect(stops[0]).toHaveAttribute('stop-color', 'var(--ink-action)')
    expect(stops[1]).toHaveAttribute('stop-color', 'var(--ink-action)')
  })

  it('o preenchimento do arco (stroke-dashoffset) acompanha o percentual calculado', () => {
    const { container } = render(<GardenProgressWheel completed={4} total={10} />)

    const fill = container.querySelector('.garden-wheel-fill')
    const circumference = 2 * Math.PI * 42
    const expectedOffset = circumference * (1 - 40 / 100)

    expect(Number(fill?.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset, 5)
  })
})
