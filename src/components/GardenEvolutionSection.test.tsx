import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GardenEvolutionSection } from './GardenEvolutionSection'

const { useGardenEvolutionMock } = vi.hoisted(() => ({ useGardenEvolutionMock: vi.fn() }))

vi.mock('../hooks/useGardenEvolution', () => ({
  useGardenEvolution: useGardenEvolutionMock,
}))

describe('GardenEvolutionSection', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra "carregando" enquanto o hook ainda não respondeu', () => {
    useGardenEvolutionMock.mockReturnValue({
      currentMonthActivities: [],
      currentMonthPoints: 0,
      completions: [],
      loading: true,
      error: null,
    })
    render(<GardenEvolutionSection communityId="c1" profileId="p1" />)
    expect(screen.getByText(/Carregando sua evolução/)).toBeInTheDocument()
  })

  it('mostra uma mensagem amigável se a tabela ainda não existir (migration não aplicada), sem travar nem quebrar', () => {
    useGardenEvolutionMock.mockReturnValue({
      currentMonthActivities: [],
      currentMonthPoints: 0,
      completions: [],
      loading: false,
      error: 'relation "garden_monthly_points" does not exist',
    })
    render(<GardenEvolutionSection communityId="c1" profileId="p1" />)
    expect(screen.getByText('Evolução do Meu Jardim indisponível no momento.')).toBeInTheDocument()
  })

  it('renderiza as duas rodas e a lista de atividades com dados reais', () => {
    useGardenEvolutionMock.mockReturnValue({
      currentMonthActivities: [
        { source: 'post', points: 5 },
        { source: 'mood_checkin', points: 3 },
      ],
      currentMonthPoints: 8,
      completions: [],
      loading: false,
      error: null,
    })
    render(<GardenEvolutionSection communityId="c1" profileId="p1" />)

    expect(screen.getByText('Desafio do mês')).toBeInTheDocument()
    expect(screen.getByText(/Progressão anual/)).toBeInTheDocument()
    expect(screen.getByText('Publicar um post')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('mostra a mensagem de conquista só quando o mês corrente já foi concluído (não quando os pontos somam 100 mas a conclusão real ainda não chegou)', () => {
    useGardenEvolutionMock.mockReturnValue({
      currentMonthActivities: [],
      currentMonthPoints: 100,
      completions: [], // nenhuma linha de conclusão real ainda
      loading: false,
      error: null,
    })
    render(<GardenEvolutionSection communityId="c1" profileId="p1" />)
    expect(screen.queryByText(/concluiu o desafio deste mês/)).not.toBeInTheDocument()
  })

  it('modo compact esconde a lista de atividades e o histórico', () => {
    useGardenEvolutionMock.mockReturnValue({
      currentMonthActivities: [],
      currentMonthPoints: 10,
      completions: [],
      loading: false,
      error: null,
    })
    render(<GardenEvolutionSection communityId="c1" profileId="p1" compact />)
    expect(screen.queryByText('Publicar um post')).not.toBeInTheDocument()
  })
})
