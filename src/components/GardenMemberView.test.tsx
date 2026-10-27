import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { GardenMemberView } from './GardenMemberView'
import { useGardenMember } from '../hooks/useGardenMember'
import type {
  GardenChallenge,
  GardenChallengeDay,
  GardenCompletion,
  GardenEnrollment,
  GardenHistoryEntry,
} from '../types/garden'
import type { Profile } from '../types/profile'

/**
 * Mocka o hook inteiro — nenhum destes testes toca o Supabase real.
 * `useGardenMember` é importado só para o `vi.mocked(...)` abaixo apontar
 * para a implementação fake registrada por `vi.mock`.
 */
vi.mock('../hooks/useGardenMember', () => ({
  useGardenMember: vi.fn(),
}))

const mockedUseGardenMember = vi.mocked(useGardenMember)

const CHALLENGE: GardenChallenge = {
  id: 'challenge-1',
  community_id: 'community-1',
  created_by: 'prof-1',
  title: 'Desafio de teste',
  description: null,
  status: 'published',
  duration_days: 5,
  starts_on: '2026-10-19',
  enrollment_opens_at: null,
  enrollment_closes_at: null,
  allow_late_enrollment: false,
  cover_image_url: null,
  created_at: '2026-10-19T00:00:00.000Z',
  updated_at: '2026-10-19T00:00:00.000Z',
  archived_at: null,
}

const ENROLLMENT: GardenEnrollment = {
  id: 'enrollment-1',
  challenge_id: CHALLENGE.id,
  profile_id: 'member-1',
  enrolled_at: '2026-10-19T00:00:00.000Z',
}

const PROFILE: Profile = {
  id: 'member-1',
  role: 'member',
  full_name: 'Membro de Teste',
  avatar_url: null,
  interests: [],
  bio: null,
  city: null,
  gallery_photos: [],
  garden_color_one: null,
  garden_color_two: null,
}

/** Dia já liberado (data fixa no passado) — usado nos testes de progresso/compartilhamento. */
const DAY_1: GardenChallengeDay = {
  id: 'day-1',
  challenge_id: CHALLENGE.id,
  day_number: 1,
  activity_date: '2020-01-01',
  title: 'Beba água',
  instructions: null,
  icon: null,
  encouragement_message: null,
  created_at: '2026-10-19T00:00:00.000Z',
  updated_at: '2026-10-19T00:00:00.000Z',
}

const DAY_2: GardenChallengeDay = {
  id: 'day-2',
  challenge_id: CHALLENGE.id,
  day_number: 2,
  activity_date: '2020-01-02',
  title: 'Alongue-se',
  instructions: null,
  icon: null,
  encouragement_message: null,
  created_at: '2026-10-19T00:00:00.000Z',
  updated_at: '2026-10-19T00:00:00.000Z',
}

const COMPLETION_DAY_1: GardenCompletion = {
  id: 'completion-1',
  challenge_id: CHALLENGE.id,
  challenge_day_id: DAY_1.id,
  enrollment_id: ENROLLMENT.id,
  profile_id: 'member-1',
  completed_at: '2020-01-01T00:00:00.000Z',
}

const HISTORY_ENTRY: GardenHistoryEntry = {
  challengeId: 'challenge-archived-1',
  challengeTitle: 'Desafio arquivado de outubro',
  daysCompleted: 6,
  totalDays: 9,
  colorOne: 'sage',
  colorTwo: null,
  lastSharedAt: '2026-09-01T00:00:00.000Z',
}

interface ApiOverrides {
  daysLoading?: Record<string, boolean>
  daysError?: Record<string, string | null>
  daysByChallenge?: Record<string, GardenChallengeDay[]>
  myEnrollments?: GardenEnrollment[]
  myCompletions?: GardenCompletion[]
  mySharedCompletionIds?: Set<string>
  enrollmentsError?: string | null
  completionsError?: string | null
  history?: GardenHistoryEntry[] | null
  historyLoading?: boolean
  historyError?: string | null
  error?: string | null
}

function makeApi(overrides: ApiOverrides = {}): ReturnType<typeof useGardenMember> {
  return {
    challenges: [CHALLENGE],
    loading: false,
    error: overrides.error ?? null,
    myEnrollments: overrides.myEnrollments ?? [ENROLLMENT],
    myCompletions: overrides.myCompletions ?? ([] as GardenCompletion[]),
    mySharedCompletionIds: overrides.mySharedCompletionIds ?? new Set<string>(),
    enrollmentsError: overrides.enrollmentsError ?? null,
    completionsError: overrides.completionsError ?? null,
    enroll: vi.fn(),
    daysByChallenge: overrides.daysByChallenge ?? {},
    daysLoading: overrides.daysLoading ?? {},
    daysError: overrides.daysError ?? {},
    fetchDays: vi.fn(),
    completeDay: vi.fn(),
    shareCompletion: vi.fn(),
    history: overrides.history ?? null,
    historyLoading: overrides.historyLoading ?? false,
    historyError: overrides.historyError ?? null,
    fetchHistory: vi.fn(),
    refresh: vi.fn(),
  }
}

/** Renderiza na tela principal (nenhum desafio selecionado) e devolve a api mockada usada. */
function renderRoot(overrides: ApiOverrides = {}) {
  const api = makeApi(overrides)
  mockedUseGardenMember.mockReturnValue(api)

  render(
    <GardenMemberView
      communityId="community-1"
      profileId="member-1"
      profile={PROFILE}
      onUpdateProfile={vi.fn()}
    />,
  )

  return api
}

/** Renderiza já inscrita no desafio mockado e clica no card para entrar no detalhe — onde os 3 estados vivem. Devolve a api mockada usada. */
function renderAndSelectChallenge(overrides: ApiOverrides = {}) {
  const api = makeApi(overrides)
  mockedUseGardenMember.mockReturnValue(api)

  render(
    <GardenMemberView
      communityId="community-1"
      profileId="member-1"
      profile={PROFILE}
      onUpdateProfile={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByText('Desafio de teste'))

  return api
}

describe('GardenMemberView — carregamento de atividades (useGardenMember mockado, sem Supabase)', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  // @testing-library/react só desmonta sozinho entre testes quando
  // `globals: true` está ligado no Vitest (não está, por escolha — ver
  // vitest.config.ts); sem isso, o DOM de um teste vaza para o próximo.
  afterEach(() => {
    cleanup()
  })

  it('mostra "Carregando atividades..." quando daysLoading é verdadeiro', () => {
    renderAndSelectChallenge({ daysLoading: { [CHALLENGE.id]: true } })

    expect(screen.getByText('Carregando atividades...')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma atividade cadastrada ainda.')).not.toBeInTheDocument()
  })

  it('mostra mensagem de erro explícita quando daysError está preenchido, nunca como lista vazia', () => {
    renderAndSelectChallenge({ daysError: { [CHALLENGE.id]: 'Falha de rede' } })

    expect(
      screen.getByText('Não foi possível carregar as atividades deste desafio: Falha de rede'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma atividade cadastrada ainda.')).not.toBeInTheDocument()
    expect(screen.queryByText('Carregando atividades...')).not.toBeInTheDocument()
  })

  it('mostra "Nenhuma atividade cadastrada ainda." só quando carregou com sucesso e não há dias', () => {
    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: false },
      daysError: { [CHALLENGE.id]: null },
      daysByChallenge: { [CHALLENGE.id]: [] },
    })

    expect(screen.getByText('Nenhuma atividade cadastrada ainda.')).toBeInTheDocument()
    expect(screen.queryByText('Carregando atividades...')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Não foi possível carregar as atividades/),
    ).not.toBeInTheDocument()
  })
})

describe('GardenMemberView — Item 1: título "Meu Jardim"', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renderiza o título da seção exatamente uma vez na tela principal', () => {
    renderRoot()

    expect(screen.getAllByText('Meu Jardim')).toHaveLength(1)
  })

  it('mantém o título único (sem duplicar) com um desafio aberto', () => {
    renderAndSelectChallenge()

    expect(screen.getAllByText('Meu Jardim')).toHaveLength(1)
  })
})

describe('GardenMemberView — Item 3: compartilhamento sem duplicata', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  const withOneCompletedDay: ApiOverrides = {
    daysLoading: { [CHALLENGE.id]: false },
    daysError: { [CHALLENGE.id]: null },
    daysByChallenge: { [CHALLENGE.id]: [DAY_1] },
    myCompletions: [COMPLETION_DAY_1],
  }

  it('oferece "Compartilhar no feed" quando a conclusão ainda não foi compartilhada', () => {
    renderAndSelectChallenge({ ...withOneCompletedDay, mySharedCompletionIds: new Set() })

    expect(screen.getByRole('button', { name: 'Compartilhar no feed' })).toBeInTheDocument()
    expect(screen.queryByText('Já compartilhado no feed')).not.toBeInTheDocument()
  })

  it('publica o compartilhamento com o conteúdo digitado, chamando shareCompletion uma única vez com os dados certos', async () => {
    const api = renderAndSelectChallenge({ ...withOneCompletedDay, mySharedCompletionIds: new Set() })
    api.shareCompletion = vi.fn().mockResolvedValue({ error: null })

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no feed' }))
    fireEvent.change(screen.getByPlaceholderText('Conte como foi (opcional)'), {
      target: { value: 'Consegui! 🎉' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => {
      expect(api.shareCompletion).toHaveBeenCalledTimes(1)
    })
    expect(api.shareCompletion).toHaveBeenCalledWith(COMPLETION_DAY_1.id, 'Consegui! 🎉')
  })

  it('mostra "Já compartilhado no feed" e remove por completo a opção de compartilhar de novo', () => {
    renderAndSelectChallenge({ ...withOneCompletedDay, mySharedCompletionIds: new Set([COMPLETION_DAY_1.id]) })

    expect(screen.getByText('Já compartilhado no feed')).toBeInTheDocument()
    // "Removida por completo" (não só desabilitada): sem o botão no DOM,
    // uma segunda chamada a shareCompletion não tem como ser disparada
    // por esta tela — é a própria estrutura que previne a duplicata.
    expect(screen.queryByRole('button', { name: 'Compartilhar no feed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
  })

  it('não mostra nenhum estado de compartilhamento (nem o composer, nem o selo) enquanto os dias ainda carregam', () => {
    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: true },
      myCompletions: [COMPLETION_DAY_1],
      mySharedCompletionIds: new Set([COMPLETION_DAY_1.id]),
    })

    expect(screen.queryByText('Compartilhar no feed')).not.toBeInTheDocument()
    expect(screen.queryByText('Já compartilhado no feed')).not.toBeInTheDocument()
  })
})

describe('GardenMemberView — Item 4: roda de progresso (dados ao vivo)', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('mostra a roda e o resumo "X de Y dias" batendo com os dias realmente concluídos', () => {
    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: false },
      daysError: { [CHALLENGE.id]: null },
      daysByChallenge: { [CHALLENGE.id]: [DAY_1, DAY_2] },
      myCompletions: [COMPLETION_DAY_1],
    })

    expect(screen.getByText('1 de 2 dias concluídos')).toBeInTheDocument()
    // Etapa N — GardenJourneyRing substituiu o GardenProgressWheel solo
    // aqui; o rótulo acessível agora descreve as duas camadas (desafio
    // atual + jornada acumulada) num único role="img".
    expect(
      screen.getByRole('img', {
        name: 'Desafio atual: 50%, 1 de 2 dias concluídos. Jornada no Círcula: 1 dia concluído.',
      }),
    ).toBeInTheDocument()
  })

  it('não mostra roda nem resumo de progresso quando o desafio ainda não tem nenhum dia gerado (total zero)', () => {
    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: false },
      daysError: { [CHALLENGE.id]: null },
      daysByChallenge: { [CHALLENGE.id]: [] },
    })

    expect(screen.queryByText(/dias concluídos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Desafio atual/ })).not.toBeInTheDocument()
  })

  it('mostra o resumo da jornada acumulada (Camada 2) somando conclusões de desafios diferentes', () => {
    const OTHER_COMPLETION: GardenCompletion = {
      id: 'completion-2',
      challenge_id: 'other-challenge',
      challenge_day_id: 'other-day',
      enrollment_id: 'other-enrollment',
      profile_id: 'member-1',
      completed_at: '2020-02-01T00:00:00.000Z',
    }

    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: false },
      daysError: { [CHALLENGE.id]: null },
      daysByChallenge: { [CHALLENGE.id]: [DAY_1, DAY_2] },
      // A conclusão de "other-challenge" não pertence ao desafio selecionado
      // (não aparece no "X de 2" do desafio atual), mas ainda soma na jornada.
      myCompletions: [COMPLETION_DAY_1, OTHER_COMPLETION],
    })

    expect(screen.getByText('1 de 2 dias concluídos')).toBeInTheDocument()
    expect(screen.getByText('Jornada no Círcula: 2 dias concluídos')).toBeInTheDocument()
  })

  it('estado inicial honesto da jornada quando não há nenhuma conclusão acumulada além da atual', () => {
    renderAndSelectChallenge({
      daysLoading: { [CHALLENGE.id]: false },
      daysError: { [CHALLENGE.id]: null },
      daysByChallenge: { [CHALLENGE.id]: [DAY_1] },
      myCompletions: [],
    })

    expect(screen.getByText('Sua jornada no Círcula está começando')).toBeInTheDocument()
  })
})

describe('GardenMemberView — Item 5: resumo e "Meu histórico"', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('começa recolhido e não busca histórico antes de ser aberto', () => {
    const api = renderRoot({ history: null })

    const toggle = screen.getByRole('button', { name: /Meu histórico/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(api.fetchHistory).not.toHaveBeenCalled()
    expect(screen.queryByText('Nenhum desafio arquivado no seu histórico ainda.')).not.toBeInTheDocument()
  })

  it('busca o histórico só na primeira expansão', () => {
    const api = renderRoot({ history: null })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(api.fetchHistory).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Meu histórico/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('não rebusca quando o histórico já foi carregado antes (mesmo vazio)', () => {
    const api = renderRoot({ history: [] })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(api.fetchHistory).not.toHaveBeenCalled()
  })

  it('mostra "Carregando histórico..." enquanto historyLoading é verdadeiro', () => {
    renderRoot({ historyLoading: true, history: null })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(screen.getByText('Carregando histórico...')).toBeInTheDocument()
  })

  it('mostra a mensagem de erro, sem loading nem lista, quando historyError está preenchido', () => {
    renderRoot({ historyError: 'Falha de rede', history: null, historyLoading: false })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(screen.getByText('Não foi possível carregar seu histórico: Falha de rede')).toBeInTheDocument()
    expect(screen.queryByText('Carregando histórico...')).not.toBeInTheDocument()
  })

  it('mostra o estado vazio, sem inventar nenhum desafio, quando o histórico é uma lista vazia', () => {
    renderRoot({ history: [] })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(screen.getByText('Nenhum desafio arquivado no seu histórico ainda.')).toBeInTheDocument()
  })

  it('exibe cada entrada do histórico com o X/Y do próprio snapshot (não de um desafio ativo qualquer)', () => {
    renderRoot({ history: [HISTORY_ENTRY] })

    fireEvent.click(screen.getByRole('button', { name: /Meu histórico/ }))

    expect(screen.getByText(HISTORY_ENTRY.challengeTitle)).toBeInTheDocument()
    expect(screen.getByText('6 de 9 dias concluídos')).toBeInTheDocument()
  })

  it('não mostra "Meu histórico" quando um desafio está aberto (fica só na tela principal)', () => {
    renderAndSelectChallenge()

    expect(screen.queryByRole('button', { name: /Meu histórico/ })).not.toBeInTheDocument()
  })
})

describe('GardenMemberView — Etapa M: nova tentativa após falha ao carregar os desafios', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('mostra a mensagem de erro e um botão "Tentar novamente" quando api.error está preenchido', () => {
    renderRoot({ error: 'Falha de rede' })

    expect(screen.getByText('Falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('chama api.refresh ao clicar em "Tentar novamente"', () => {
    const api = renderRoot({ error: 'Falha de rede' })

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(api.refresh).toHaveBeenCalledTimes(1)
  })

  it('não mostra o grid de desafios nem o histórico enquanto houver erro (não mistura os dois estados)', () => {
    renderRoot({ error: 'Falha de rede' })

    expect(screen.queryByText('Desafio de teste')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Meu histórico/ })).not.toBeInTheDocument()
  })
})

describe('GardenMemberView — Etapa AA: erro ao carregar inscrições/conclusões não bloqueia a tela', () => {
  beforeEach(() => {
    mockedUseGardenMember.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('mostra um aviso com "Tentar novamente" quando só enrollmentsError está preenchido, sem esconder o grid de desafios', () => {
    renderRoot({ enrollmentsError: 'Falha ao confirmar inscrição' })

    expect(screen.getByText(/Falha ao confirmar inscrição/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    // Diferente do erro principal (api.error), este NÃO bloqueia a tela —
    // o grid de desafios continua visível.
    expect(screen.getByText('Desafio de teste')).toBeInTheDocument()
  })

  it('mostra um aviso quando só completionsError está preenchido', () => {
    renderRoot({ completionsError: 'Falha ao confirmar conclusões' })

    expect(screen.getByText(/Falha ao confirmar conclusões/)).toBeInTheDocument()
  })

  it('quando as duas falham, mostra só uma mensagem (a de inscrições), sem duplicar', () => {
    renderRoot({ enrollmentsError: 'Erro de inscrições', completionsError: 'Erro de conclusões' })

    expect(screen.getByText(/Erro de inscrições/)).toBeInTheDocument()
    expect(screen.queryByText(/Erro de conclusões/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(1)
  })

  it('chama api.refresh ao clicar em "Tentar novamente" deste aviso', () => {
    const api = renderRoot({ enrollmentsError: 'Falha ao confirmar inscrição' })

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(api.refresh).toHaveBeenCalledTimes(1)
  })

  it('sem nenhum dos dois erros, não mostra o aviso', () => {
    renderRoot()

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })
})
