import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenShareCard } from './GardenShareCard'
import { GARDEN_COLOR_HEX } from '../types/garden'
import type { GardenShareSummary } from '../types/post'

/**
 * Card do Feed (post_type='garden_share') — recebe só `share` (o
 * snapshot congelado de garden_shares) e `content`. Nunca lê um hook
 * "ao vivo": estes testes existem para provar isso na prática, não só
 * por leitura de código — renderizando com valores que, de propósito,
 * não bateriam com nenhum desafio "atual" hipotético, e conferindo que
 * é exatamente o valor do snapshot que aparece na tela (item 4 da
 * auditoria: "sem confundir dados atuais com snapshots históricos").
 */
const SHARE: GardenShareSummary = {
  id: 'share-1',
  challenge_id: 'challenge-1',
  challenge_day_id: 'day-3',
  challenge_title: 'Desafio de outubro',
  day_number: 3,
  day_title: 'Alongamento matinal',
  days_completed: 3,
  total_days: 7,
  color_one: 'sage',
  color_two: 'rose',
}

describe('GardenShareCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('mostra título do desafio, dia e progresso vindos exclusivamente do snapshot recebido', () => {
    render(<GardenShareCard share={SHARE} />)

    expect(screen.getByText('Desafio de outubro')).toBeInTheDocument()
    expect(screen.getByText('Alongamento matinal')).toBeInTheDocument()
    expect(screen.getByText(/concluiu o dia 3/)).toBeInTheDocument()
    expect(screen.getByText('3 de 7 dias concluídos')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Progresso do desafio: 43%, 3 de 7 dias concluídos' }),
    ).toBeInTheDocument()
  })

  it('usa as cores do próprio snapshot (não cores "atuais" de perfil)', () => {
    const { container } = render(<GardenShareCard share={SHARE} />)

    const stops = container.querySelectorAll('stop')
    expect(stops[0]).toHaveAttribute('stop-color', GARDEN_COLOR_HEX.sage)
    expect(stops[1]).toHaveAttribute('stop-color', GARDEN_COLOR_HEX.rose)
  })

  it('com cores nulas no snapshot, cai no tom neutro padrão em vez de inventar uma cor', () => {
    const { container } = render(
      <GardenShareCard share={{ ...SHARE, color_one: null, color_two: null }} />,
    )

    const stops = container.querySelectorAll('stop')
    expect(stops[0]).toHaveAttribute('stop-color', '#c9b48f')
    expect(stops[1]).toHaveAttribute('stop-color', '#c9b48f')
  })

  it('exibe a mensagem livre quando preenchida, e nada quando vazia/só espaços', () => {
    const { rerender } = render(<GardenShareCard share={SHARE} content="Foi incrível!" />)
    expect(screen.getByText('Foi incrível!')).toBeInTheDocument()

    rerender(<GardenShareCard share={SHARE} content="   " />)
    expect(screen.queryByText('Foi incrível!')).not.toBeInTheDocument()

    rerender(<GardenShareCard share={SHARE} content={null} />)
    expect(screen.queryByText('Foi incrível!')).not.toBeInTheDocument()
  })
})
