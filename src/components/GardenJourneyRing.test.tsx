import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenJourneyRing } from './GardenJourneyRing'

/**
 * Roda em camadas (Etapa N) — cobre: anel interno (mesma matemática do
 * GardenProgressWheel), e o anel externo honesto (nunca mostra um
 * percentual de "meta" fictícia, só a contagem real no rótulo).
 */
describe('GardenJourneyRing', () => {
  afterEach(() => {
    cleanup()
  })

  it('anel interno (desafio atual): percentual e contagem corretos no rótulo acessível', () => {
    render(
      <GardenJourneyRing
        current={{ completed: 2, total: 5 }}
        journey={{ totalDaysCompleted: 0, challengesFinished: 0 }}
      />,
    )

    expect(
      screen.getByRole('img', {
        name: 'Desafio atual: 40%, 2 de 5 dias concluídos. Sua jornada no Círcula está começando.',
      }),
    ).toBeInTheDocument()
  })

  it('mostra o percentual do desafio atual no centro da roda', () => {
    const { container } = render(
      <GardenJourneyRing
        current={{ completed: 1, total: 4 }}
        journey={{ totalDaysCompleted: 0, challengesFinished: 0 }}
      />,
    )

    const centerValue = container.querySelector('.garden-journey-ring-center strong')
    expect(centerValue?.textContent).toBe('25')
  })

  it('anel externo (jornada): rótulo com dias e desafios concluídos, nunca um percentual', () => {
    render(
      <GardenJourneyRing
        current={{ completed: 0, total: 0 }}
        journey={{ totalDaysCompleted: 12, challengesFinished: 2 }}
      />,
    )

    const ring = screen.getByRole('img')
    expect(ring).toHaveAccessibleName(/Jornada no Círcula: 12 dias concluídos · 2 desafios concluídos/)
    // Nunca aparece como "NN%" fora do contexto do anel interno (desafio atual).
    expect(ring.getAttribute('aria-label')).not.toMatch(/Jornada no Círcula:.*%/)
  })

  it('sem nenhuma conclusão em nenhuma camada, não desenha o preenchimento do anel externo (só o traço de fundo)', () => {
    const { container } = render(
      <GardenJourneyRing current={{ completed: 0, total: 0 }} journey={{ totalDaysCompleted: 0, challengesFinished: 0 }} />,
    )

    expect(container.querySelector('.garden-journey-ring-outer-fill')).not.toBeInTheDocument()
    expect(container.querySelector('.garden-journey-ring-outer-track')).toBeInTheDocument()
  })

  it('com alguma jornada acumulada, desenha o preenchimento do anel externo', () => {
    const { container } = render(
      <GardenJourneyRing current={{ completed: 0, total: 0 }} journey={{ totalDaysCompleted: 3, challengesFinished: 0 }} />,
    )

    expect(container.querySelector('.garden-journey-ring-outer-fill')).toBeInTheDocument()
  })

  it('desafio atual sem total (0) fica em 0%, sem quebrar', () => {
    render(<GardenJourneyRing current={{ completed: 0, total: 0 }} journey={{ totalDaysCompleted: 0, challengesFinished: 0 }} />)

    const centerValue = screen.getByText('0')
    expect(centerValue).toBeInTheDocument()
  })
})
