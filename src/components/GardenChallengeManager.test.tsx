import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { GardenChallengeManager } from './GardenChallengeManager'
import { useGardenChallenges } from '../hooks/useGardenChallenges'
import { GARDEN_INCENTIVE_MESSAGE_LIBRARY } from '../types/garden'
import type { GardenChallenge, GardenChallengeDay, GardenEnrollment } from '../types/garden'

/**
 * Mocka o hook inteiro — nenhum destes testes toca o Supabase real.
 * Mesmo padrão de GardenMemberView.test.tsx.
 */
vi.mock('../hooks/useGardenChallenges', () => ({
  useGardenChallenges: vi.fn(),
}))

const mockedUseGardenChallenges = vi.mocked(useGardenChallenges)

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

const DRAFT_CHALLENGE: GardenChallenge = {
  ...CHALLENGE,
  id: 'challenge-draft',
  title: 'Desafio em rascunho',
  status: 'draft',
}
const ARCHIVED_CHALLENGE: GardenChallenge = {
  ...CHALLENGE,
  id: 'challenge-archived',
  title: 'Desafio arquivado',
  status: 'archived',
}

const DAY_1: GardenChallengeDay = {
  id: 'day-1',
  challenge_id: CHALLENGE.id,
  day_number: 1,
  activity_date: '2026-10-19',
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
  activity_date: '2026-10-20',
  title: 'Alongue-se',
  instructions: null,
  icon: null,
  encouragement_message: null,
  created_at: '2026-10-19T00:00:00.000Z',
  updated_at: '2026-10-19T00:00:00.000Z',
}

function mockApi(overrides: Partial<ReturnType<typeof useGardenChallenges>> = {}) {
  const api = {
    challenges: [CHALLENGE],
    loading: false,
    error: null,
    createChallenge: vi.fn().mockResolvedValue({ error: null }),
    updateChallenge: vi.fn().mockResolvedValue({ error: null }),
    generateDays: vi.fn().mockResolvedValue({ error: null }),
    publishChallenge: vi.fn().mockResolvedValue({ error: null }),
    archiveChallenge: vi.fn().mockResolvedValue({ error: null }),
    deleteChallenge: vi.fn().mockResolvedValue({ error: null }),
    daysByChallenge: { [CHALLENGE.id]: [DAY_1] },
    daysLoading: {},
    daysError: {},
    fetchDays: vi.fn().mockResolvedValue({ error: null }),
    updateDay: vi.fn().mockResolvedValue({ error: null }),
    participantsByChallenge: {},
    completionsByChallenge: {},
    progressLoading: {},
    participantsError: {},
    completionsError: {},
    fetchProgress: vi.fn(),
    publishDailyPost: vi.fn().mockResolvedValue({ error: null }),
    refresh: vi.fn(),
    ...overrides,
  }
  mockedUseGardenChallenges.mockReturnValue(api as unknown as ReturnType<typeof useGardenChallenges>)
  return api
}

/** Expande o desafio e abre a aba "Publicar incentivo". */
function openIncentiveTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar incentivo' }))
}

describe('GardenChallengeManager — aba "Publicar incentivo" (Etapas O/P)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('carregamento dos dias dentro da própria aba', () => {
    it('mostra "Carregando dias..." quando os dias ainda não terminaram de carregar', () => {
      mockApi({ daysByChallenge: {}, daysLoading: { [CHALLENGE.id]: true } })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      expect(screen.getByText('Carregando dias...')).toBeInTheDocument()
      expect(screen.queryByLabelText('Atividade do dia')).not.toBeInTheDocument()
    })

    it('mostra o erro quando a busca dos dias falha', () => {
      mockApi({ daysByChallenge: {}, daysError: { [CHALLENGE.id]: 'Falha de rede' } })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      expect(screen.getByText(/Não foi possível carregar os dias deste desafio: Falha de rede/)).toBeInTheDocument()
    })

    it('quando não há dias gerados, orienta a gerá-los primeiro e permite ir direto para a aba "Dias"', () => {
      const api = mockApi({ daysByChallenge: { [CHALLENGE.id]: [] } })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      expect(
        screen.getByText('Nenhum dia gerado ainda — gere os dias do desafio antes de publicar um incentivo.'),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText('Atividade do dia')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Ir para "Dias"' }))
      expect(screen.getByRole('button', { name: 'Dias' })).toHaveClass('panel-subtab--active')
      expect(screen.getByText('Nenhum dia gerado ainda.')).toBeInTheDocument()
      expect(api.fetchDays).toHaveBeenCalledWith(CHALLENGE.id)
    })
  })

  describe('seletor de estilo e pré-visualização', () => {
    beforeEach(() => {
      mockApi()
    })

    it('mostra as seis opções de estilo, agrupadas sob o mesmo rótulo visível e acessível', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      const picker = screen.getByRole('group', { name: 'Estilo da mensagem (opcional)' })
      for (const label of ['Incentivo', 'Reflexão', 'Conquista', 'Consistência', 'Acolhimento', 'Celebração']) {
        expect(within(picker).getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
      }
    })

    it('não mostra pré-visualização antes de um dia ser selecionado', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Hoje é dia de respirar fundo.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))
      expect(screen.queryByText('Pré-visualização')).not.toBeInTheDocument()
    })

    it('mostra a pré-visualização assim que há dia + mensagem, mesmo sem nenhum estilo escolhido', () => {
      const { container } = render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Hoje é dia de respirar fundo.' },
      })

      expect(screen.getByText('Pré-visualização')).toBeInTheDocument()
      const preview = container.querySelector('.garden-incentive-template')
      expect(preview).not.toBeNull()
      // Neutra: nenhuma classe de categoria (--motivacao, --acolhimento, etc.) aplicada.
      expect(preview?.className).toBe('garden-incentive-template')
      expect(screen.getByText('Beba água')).toBeInTheDocument()
    })

    it('escolher um template aplica a cor/eyebrow da categoria à pré-visualização, mantendo título e mensagem reais', () => {
      const { container } = render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Hoje é dia de respirar fundo.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))

      const preview = container.querySelector('.garden-incentive-template.garden-incentive-template--acolhimento')
      expect(preview).not.toBeNull()
      expect(preview?.querySelector('.garden-incentive-template-title')).toHaveTextContent('Beba água')
      expect(preview?.querySelector('.garden-incentive-template-message')).toHaveTextContent(
        'Hoje é dia de respirar fundo.',
      )
    })

    it('mostra a dica do estilo escolhido como texto visível (não só tooltip), e a esconde ao desmarcar', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      const button = screen.getByRole('button', { name: /Conquista/ })
      fireEvent.click(button)
      expect(screen.getByText('Reconhecer um passo concreto já dado, por menor que seja.')).toBeInTheDocument()

      fireEvent.click(button)
      expect(
        screen.queryByText('Reconhecer um passo concreto já dado, por menor que seja.'),
      ).not.toBeInTheDocument()
    })

    it('trocar de template preserva a mensagem já digitada', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem escrita pela profissional.' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Incentivo/ }))
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem escrita pela profissional.')

      fireEvent.click(screen.getByRole('button', { name: /Celebração/ }))
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem escrita pela profissional.')
    })

    it('clicar no template já ativo o desmarca — a pré-visualização continua (agora neutra), só perde a cor da categoria', () => {
      const { container } = render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), { target: { value: 'Texto qualquer.' } })

      const button = screen.getByRole('button', { name: /Conquista/ })
      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(
        container.querySelector('.garden-incentive-template.garden-incentive-template--conquista'),
      ).not.toBeNull()

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByText('Pré-visualização')).toBeInTheDocument()
      expect(
        container.querySelector('.garden-incentive-template.garden-incentive-template--conquista'),
      ).toBeNull()
    })

    it('ao publicar com sucesso, limpa a mensagem, desmarca o template e some a pré-visualização', async () => {
      const api = mockApi()
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Força, participantes!' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Incentivo/ }))

      fireEvent.click(screen.getByRole('button', { name: 'Publicar no feed' }))

      await vi.waitFor(() => expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue(''))
      expect(api.publishDailyPost).toHaveBeenCalledWith(DAY_1.id, 'Força, participantes!')
      expect(screen.queryByText('Pré-visualização')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Incentivo/ })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('biblioteca de mensagens-modelo (Etapa Q)', () => {
    beforeEach(() => {
      mockApi()
    })

    it('sem estilo escolhido, orienta a escolher um para ver sugestões — e não publica nada ao consultar', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      expect(
        screen.getByText('Escolha um estilo acima para ver sugestões de mensagem dessa categoria.'),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Sugestões de mensagem/)).not.toBeInTheDocument()
    })

    it('escolher um estilo mostra as sugestões daquela categoria, sem preencher ou publicar nada por conta própria', () => {
      const api = mockApi()
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))

      expect(screen.getByText('Sugestões de mensagem — Acolhimento')).toBeInTheDocument()
      for (const message of GARDEN_INCENTIVE_MESSAGE_LIBRARY.acolhimento) {
        expect(screen.getByText(message)).toBeInTheDocument()
      }
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('')
      expect(api.publishDailyPost).not.toHaveBeenCalled()
    })

    it('com o campo vazio, aplicar uma sugestão preenche a mensagem direto, sem pedir confirmação', () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.click(screen.getByRole('button', { name: /Conquista/ }))
      const [suggestion] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.conquista
      const item = screen.getByText(suggestion).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Usar esta sugestão' }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue(suggestion)
      confirmSpy.mockRestore()
    })

    it('a mensagem aplicada continua totalmente editável (não é travada pela sugestão)', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.click(screen.getByRole('button', { name: /Conquista/ }))
      const [suggestion] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.conquista
      const item = screen.getByText(suggestion).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Usar esta sugestão' }))

      const textarea = screen.getByLabelText('Mensagem de incentivo')
      fireEvent.change(textarea, { target: { value: `${suggestion} Editado pela nutricionista.` } })
      expect(textarea).toHaveValue(`${suggestion} Editado pela nutricionista.`)
    })

    it('com texto já digitado e diferente, pede confirmação antes de substituir — cancelar preserva o texto original', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Texto original da profissional.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Conquista/ }))
      const [suggestion] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.conquista
      const item = screen.getByText(suggestion).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Usar esta sugestão' }))

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Texto original da profissional.')
      confirmSpy.mockRestore()
    })

    it('com texto já digitado e diferente, confirmar a substituição aplica a sugestão', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Texto original da profissional.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Conquista/ }))
      const [suggestion] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.conquista
      const item = screen.getByText(suggestion).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Usar esta sugestão' }))

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue(suggestion)
      confirmSpy.mockRestore()
    })

    it('trocar de estilo não altera a mensagem já digitada (escolha de estilo ≠ escolha de mensagem)', () => {
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem escrita livremente.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Conquista/ }))
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem escrita livremente.')

      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem escrita livremente.')
      expect(screen.getByText('Sugestões de mensagem — Acolhimento')).toBeInTheDocument()
    })

    it('a pré-visualização reflete a mensagem aplicada da biblioteca assim que há um dia selecionado', () => {
      const { container } = render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))
      const [suggestion] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.acolhimento
      const item = screen.getByText(suggestion).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Usar esta sugestão' }))

      const preview = container.querySelector('.garden-incentive-template.garden-incentive-template--acolhimento')
      expect(preview?.querySelector('.garden-incentive-template-message')).toHaveTextContent(suggestion)
    })
  })
})

describe('GardenChallengeManager — lista de desafios (Etapa R)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('organização: desafios ativos x arquivados', () => {
    it('mostra o divisor "Arquivados" só antes dos desafios arquivados, depois dos ativos, na mesma lista', () => {
      mockApi({ challenges: [DRAFT_CHALLENGE, ARCHIVED_CHALLENGE] })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      const list = screen.getByText(DRAFT_CHALLENGE.title).closest('.panel-events-list') as HTMLElement
      const children = Array.from(list.children).map((el) => el.textContent ?? '')
      const draftIndex = children.findIndex((t) => t.includes(DRAFT_CHALLENGE.title))
      const dividerIndex = children.findIndex((t) => t === 'Arquivados')
      const archivedIndex = children.findIndex((t) => t.includes(ARCHIVED_CHALLENGE.title))

      // Ordem: desafio ativo, depois o divisor, depois o desafio arquivado — tudo no mesmo container.
      expect(draftIndex).toBeLessThan(dividerIndex)
      expect(dividerIndex).toBeLessThan(archivedIndex)
    })

    it('não mostra o divisor "Arquivados" quando não há nenhum desafio arquivado', () => {
      mockApi({ challenges: [DRAFT_CHALLENGE] })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      expect(screen.queryByRole('heading', { name: 'Arquivados' })).not.toBeInTheDocument()
    })

    it('quando só há arquivados, o divisor "Arquivados" aparece antes deles, sem nenhum item ativo', () => {
      mockApi({ challenges: [ARCHIVED_CHALLENGE] })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      expect(screen.getByRole('heading', { name: 'Arquivados' })).toBeInTheDocument()
      expect(screen.getByText(ARCHIVED_CHALLENGE.title)).toBeInTheDocument()
    })

    it('arquivar um desafio expandido preserva a mensagem/estilo em composição (Etapa S — corrige regressão da Etapa R)', async () => {
      const archiveChallenge = vi.fn().mockResolvedValue({ error: null })
      mockApi({ challenges: [CHALLENGE], archiveChallenge })
      const { rerender } = render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      openIncentiveTab()
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem ainda não publicada.' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Acolhimento/ }))

      // Arquiva pelo botão da linha (fora do painel expandido) — antes da Etapa S, mover o
      // desafio para uma lista/container diferente desmontava e perdia esse estado.
      fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }))
      await vi.waitFor(() => expect(archiveChallenge).toHaveBeenCalledWith(CHALLENGE.id))

      // Simula o refresh que useGardenChallenges faria após arquivar (status -> 'archived').
      mockApi({ challenges: [{ ...CHALLENGE, status: 'archived' }], archiveChallenge })
      rerender(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem ainda não publicada.')
      expect(screen.getByRole('button', { name: /Acolhimento/ })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('excluir desafio exige confirmação (ação irreversível)', () => {
    it('pede confirmação mencionando o título do desafio antes de excluir', () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining(DRAFT_CHALLENGE.title))
      expect(api.deleteChallenge).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    it('confirmando, chama deleteChallenge com o id do desafio', () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      expect(api.deleteChallenge).toHaveBeenCalledWith(DRAFT_CHALLENGE.id)
      confirmSpy.mockRestore()
    })

    it('publicar não pede confirmação', () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(api.publishChallenge).toHaveBeenCalledWith(DRAFT_CHALLENGE.id)
      confirmSpy.mockRestore()
    })

    it('arquivar não pede confirmação (só excluir é irreversível)', () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(api.archiveChallenge).toHaveBeenCalledWith(DRAFT_CHALLENGE.id)
      confirmSpy.mockRestore()
    })
  })

  describe('estado de "em andamento" por linha (evita duplo clique disparar a ação duas vezes)', () => {
    it('mostra "Excluindo..." e desabilita as outras ações da linha enquanto a exclusão está em voo', async () => {
      let resolveDelete!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDelete = resolve }),
      )
      mockApi({ challenges: [DRAFT_CHALLENGE], deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Arquivar' })).toBeDisabled()

      resolveDelete({ error: null })
      await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Excluir' })).not.toBeDisabled())
    })

    it('a ação em andamento numa linha não desabilita as ações de outra linha', async () => {
      let resolveArchive!: (value: { error: string | null }) => void
      const archiveChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveArchive = resolve }),
      )
      mockApi({ challenges: [DRAFT_CHALLENGE, CHALLENGE], archiveChallenge })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      const archiveButtons = screen.getAllByRole('button', { name: 'Arquivar' })
      fireEvent.click(archiveButtons[0])

      // O outro desafio (CHALLENGE, publicado) também tem "Arquivar" — deve continuar ativo.
      expect(archiveButtons[1]).not.toBeDisabled()

      resolveArchive({ error: null })
      await vi.waitFor(() => expect(archiveButtons[0]).not.toBeDisabled())
    })
  })

  describe('concorrência entre ações em desafios diferentes (Etapa AC — Finding 4)', () => {
    it('duas ações em desafios diferentes ficam em andamento ao mesmo tempo, cada uma com seu próprio indicador', async () => {
      let resolveArchiveA!: (value: { error: string | null }) => void
      const archiveChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveArchiveA = resolve }),
      )
      let resolveDeleteB!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDeleteB = resolve }),
      )
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      mockApi({ challenges: [DRAFT_CHALLENGE, B], archiveChallenge, deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      // Inicia "Arquivar" em A (linha 0) e "Excluir" em B (linha 1) — as duas ficam pendentes.
      fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[0])
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])

      expect(screen.getByRole('button', { name: 'Arquivando...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled()

      resolveArchiveA({ error: null })
      resolveDeleteB({ error: null })
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Arquivando...' })).not.toBeInTheDocument())
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Excluindo...' })).not.toBeInTheDocument())
    })

    it('a conclusão da primeira ação (A) não libera o indicador da segunda (B), ainda em voo', async () => {
      let resolveArchiveA!: (value: { error: string | null }) => void
      const archiveChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveArchiveA = resolve }),
      )
      const deleteChallenge = vi.fn(() => new Promise<{ error: string | null }>(() => {})) // nunca resolve nesta ponta
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      mockApi({ challenges: [DRAFT_CHALLENGE, B], archiveChallenge, deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[0])
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])

      resolveArchiveA({ error: null })
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Arquivando...' })).not.toBeInTheDocument())

      // B continua em andamento — a conclusão de A não a liberou.
      expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled()
      // A já liberou as próprias ações (Editar de A, primeira linha).
      expect(screen.getAllByRole('button', { name: 'Editar' })[0]).not.toBeDisabled()
    })

    it('a conclusão da segunda ação (B) não altera indevidamente o estado da primeira (A), ainda em voo', async () => {
      const archiveChallenge = vi.fn(() => new Promise<{ error: string | null }>(() => {})) // nunca resolve nesta ponta
      let resolveDeleteB!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDeleteB = resolve }),
      )
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      mockApi({ challenges: [DRAFT_CHALLENGE, B], archiveChallenge, deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[0])
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])

      resolveDeleteB({ error: null })
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Excluindo...' })).not.toBeInTheDocument())

      // A continua em andamento — a conclusão de B não a liberou nem a alterou.
      expect(screen.getByRole('button', { name: 'Arquivando...' })).toBeDisabled()
    })

    it('a falha de uma ação (A) libera apenas o próprio estado — a outra (B) continua em andamento', async () => {
      let resolveArchiveA!: (value: { error: string | null }) => void
      const archiveChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveArchiveA = resolve }),
      )
      let resolveDeleteB!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDeleteB = resolve }),
      )
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      mockApi({ challenges: [DRAFT_CHALLENGE, B], archiveChallenge, deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[0])
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])

      resolveArchiveA({ error: 'Falha ao arquivar.' })
      await vi.waitFor(() => expect(screen.getByText('Falha ao arquivar.')).toBeInTheDocument())

      // A liberou seu próprio estado (erro tratado pelo mecanismo existente, botões de A livres).
      expect(screen.getAllByRole('button', { name: 'Editar' })[0]).not.toBeDisabled()
      // B não foi cancelada nem alterada pela falha de A — continua em andamento.
      expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled()

      resolveDeleteB({ error: null })
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Excluindo...' })).not.toBeInTheDocument())
    })

    it('clique duplicado na mesma ação, antes do botão desabilitar, não dispara a RPC duas vezes', () => {
      const archiveChallenge = vi.fn(() => new Promise<{ error: string | null }>(() => {}))
      mockApi({ challenges: [DRAFT_CHALLENGE], archiveChallenge })
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      const button = screen.getByRole('button', { name: 'Arquivar' })
      fireEvent.click(button)
      fireEvent.click(button)

      expect(archiveChallenge).toHaveBeenCalledTimes(1)
    })

    it('excluir um desafio não encerra a edição de outro, mesmo com uma terceira ação concorrente em andamento (Etapas AB + AC)', async () => {
      let resolveDeleteB!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDeleteB = resolve }),
      )
      let resolveArchiveC!: (value: { error: string | null }) => void
      const archiveChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveArchiveC = resolve }),
      )
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      const C = { ...DRAFT_CHALLENGE, id: 'challenge-c', title: 'Desafio C' }
      mockApi({ challenges: [DRAFT_CHALLENGE, B, C], deleteChallenge, archiveChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título de A, não salvo' } })

      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])
      fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[2])

      resolveDeleteB({ error: null })
      await vi.waitFor(() => expect(deleteChallenge).toHaveBeenCalledWith(B.id))

      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('Título de A, não salvo')
      expect(screen.getByRole('button', { name: 'Arquivando...' })).toBeDisabled()

      resolveArchiveC({ error: null })
      await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Arquivando...' })).not.toBeInTheDocument())
    })
  })
})

describe('GardenChallengeManager — erro de ação (publish/archive/delete) associado ao desafio (Etapa AD)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('erro de publicação por ausência de dias aparece junto ao desafio, como alerta acessível', async () => {
    const publishChallenge = vi.fn().mockResolvedValue({ error: 'Cadastre pelo menos um dia antes de publicar.' })
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Cadastre pelo menos um dia antes de publicar.'),
    )
    const row = screen.getByText(DRAFT_CHALLENGE.title).closest('.panel-events-item') as HTMLElement
    expect(within(row).getByRole('alert')).toHaveTextContent('Cadastre pelo menos um dia antes de publicar.')
  })

  it('erro de permissão ("not_authorized" já traduzido) aparece junto ao desafio', async () => {
    const publishChallenge = vi.fn().mockResolvedValue({ error: 'Você não tem permissão para esta ação.' })
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await vi.waitFor(() => expect(screen.getByText('Você não tem permissão para esta ação.')).toBeInTheDocument())
  })

  it('erro de status incompatível ("challenge_not_draft" já traduzido) aparece junto ao desafio', async () => {
    const publishChallenge = vi
      .fn()
      .mockResolvedValue({ error: 'Só é possível fazer isso enquanto o desafio está em rascunho.' })
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await vi.waitFor(() =>
      expect(screen.getByText('Só é possível fazer isso enquanto o desafio está em rascunho.')).toBeInTheDocument(),
    )
  })

  it('isolamento: o erro de publicar o desafio A não aparece na linha do desafio B', async () => {
    const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
    const publishChallenge = vi.fn().mockResolvedValue({ error: 'Cadastre pelo menos um dia antes de publicar.' })
    mockApi({ challenges: [DRAFT_CHALLENGE, B], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Publicar' })[0])
    await vi.waitFor(() =>
      expect(screen.getByText('Cadastre pelo menos um dia antes de publicar.')).toBeInTheDocument(),
    )

    const rowA = screen.getByText(DRAFT_CHALLENGE.title).closest('.panel-events-item') as HTMLElement
    const rowB = screen.getByText(B.title).closest('.panel-events-item') as HTMLElement
    expect(within(rowA).getByRole('alert')).toBeInTheDocument()
    expect(within(rowB).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('isolamento: arquivar com sucesso o desafio B não limpa (nem toca) o erro de publicar já mostrado em A', async () => {
    const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
    const publishChallenge = vi.fn().mockResolvedValue({ error: 'Cadastre pelo menos um dia antes de publicar.' })
    const archiveChallenge = vi.fn().mockResolvedValue({ error: null })
    mockApi({ challenges: [DRAFT_CHALLENGE, B], publishChallenge, archiveChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Publicar' })[0])
    await vi.waitFor(() =>
      expect(screen.getByText('Cadastre pelo menos um dia antes de publicar.')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Arquivar' })[1])
    await vi.waitFor(() => expect(archiveChallenge).toHaveBeenCalledWith(B.id))

    // O erro de A, de uma ação totalmente diferente, continua intacto.
    expect(screen.getByText('Cadastre pelo menos um dia antes de publicar.')).toBeInTheDocument()
  })

  it('iniciar uma nova tentativa de publicar no mesmo desafio limpa o erro anterior imediatamente', async () => {
    let resolveSecond!: (value: { error: string | null }) => void
    const publishChallenge = vi
      .fn()
      .mockResolvedValueOnce({ error: 'Cadastre pelo menos um dia antes de publicar.' })
      .mockImplementationOnce(
        () => new Promise<{ error: string | null }>((resolve) => { resolveSecond = resolve }),
      )
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await vi.waitFor(() =>
      expect(screen.getByText('Cadastre pelo menos um dia antes de publicar.')).toBeInTheDocument(),
    )

    // Dias foram gerados e a profissional tenta publicar de novo: o erro antigo
    // desaparece assim que a nova tentativa começa, não só se/quando ela suceder.
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(screen.queryByText('Cadastre pelo menos um dia antes de publicar.')).not.toBeInTheDocument()

    resolveSecond({ error: null })
    await vi.waitFor(() => expect(publishChallenge).toHaveBeenCalledTimes(2))
  })

  it('sem regressão: o botão volta a "Publicar" (habilitado) depois do erro, sem ficar travado em "Publicando..."', async () => {
    const publishChallenge = vi.fn().mockResolvedValue({ error: 'Cadastre pelo menos um dia antes de publicar.' })
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Publicar' })).not.toBeDisabled())
    expect(screen.queryByRole('button', { name: 'Publicando...' })).not.toBeInTheDocument()
  })

  it('sem regressão: "Publicando..." aparece e desabilita a linha enquanto a RPC está em voo', async () => {
    let resolvePublish!: (value: { error: string | null }) => void
    const publishChallenge = vi.fn(
      () => new Promise<{ error: string | null }>((resolve) => { resolvePublish = resolve }),
    )
    mockApi({ challenges: [DRAFT_CHALLENGE], publishChallenge })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    expect(screen.getByRole('button', { name: 'Publicando...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()

    resolvePublish({ error: null })
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Publicando...' })).not.toBeInTheDocument())
  })
})

describe('GardenChallengeManager — exclusão do desafio em edição no formulário principal (Etapa AB — Finding 3)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  /** Clica em "Editar" (nível de desafio, único na tela) e digita um título diferente. */
  function startEditingAndDirty(newTitle: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: newTitle } })
  }

  describe('Cenário A — excluir o desafio que está sendo editado', () => {
    it('exclusão bem-sucedida encerra a edição e limpa o formulário (volta para "Criar desafio")', async () => {
      mockApi({ challenges: [DRAFT_CHALLENGE] })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      startEditingAndDirty('Título editado, não salvo')
      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Criar desafio' })).toBeInTheDocument())
      expect(screen.getByLabelText('Título')).toHaveValue('')
    })

    it('não pede uma segunda confirmação de descarte só porque o próprio desafio editado foi excluído', async () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      startEditingAndDirty('Título editado, não salvo')
      confirmSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      await vi.waitFor(() => expect(api.deleteChallenge).toHaveBeenCalled())

      // Só o confirm de "Excluir... essa ação não pode ser desfeita" — o
      // encerramento do formulário não passa por `startEdit`, então não
      // dispara o confirm de "dados não salvos".
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Excluir'))
    })
  })

  describe('Cenário B — excluir outro desafio enquanto existe uma edição aberta', () => {
    it('preserva a edição e os valores digitados do desafio A ao excluir o desafio B', async () => {
      const B = { ...DRAFT_CHALLENGE, id: 'challenge-b', title: 'Desafio B' }
      const api = mockApi({ challenges: [DRAFT_CHALLENGE, B] })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título de A, não salvo' } })

      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])
      await vi.waitFor(() => expect(api.deleteChallenge).toHaveBeenCalledWith(B.id))

      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('Título de A, não salvo')
    })
  })

  describe('Cenário C — exclusão cancelada ou malsucedida', () => {
    it('cancelar a confirmação de exclusão não altera o formulário em edição', () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      startEditingAndDirty('Título editado, não salvo')
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      expect(api.deleteChallenge).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('Título editado, não salvo')
    })

    it('exclusão malsucedida (erro) mantém o formulário em edição intacto e mostra o erro', async () => {
      const deleteChallenge = vi.fn().mockResolvedValue({ error: 'Não foi possível excluir agora.' })
      mockApi({ challenges: [DRAFT_CHALLENGE], deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      startEditingAndDirty('Título editado, não salvo')
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      await vi.waitFor(() => expect(screen.getByText('Não foi possível excluir agora.')).toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('Título editado, não salvo')
    })
  })

  describe('Cenário D — tentativa de salvar após a exclusão do desafio em edição', () => {
    it('depois da exclusão, "Salvar desafio" vira "Criar desafio" — não há mais como submeter contra o id excluído', async () => {
      const api = mockApi({ challenges: [DRAFT_CHALLENGE] })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      startEditingAndDirty('Título editado, não salvo')
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Criar desafio' })).toBeInTheDocument())

      expect(screen.queryByRole('button', { name: 'Salvar desafio' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Criar desafio' })).toBeInTheDocument()
      expect(api.updateChallenge).not.toHaveBeenCalled()
    })
  })

  describe('corrida: editingId muda para outro desafio enquanto a exclusão ainda está em voo', () => {
    it('não desfaz a edição mais nova (de C) iniciada durante a exclusão pendente de A', async () => {
      let resolveDelete!: (value: { error: string | null }) => void
      const deleteChallenge = vi.fn(
        () => new Promise<{ error: string | null }>((resolve) => { resolveDelete = resolve }),
      )
      const C = { ...DRAFT_CHALLENGE, id: 'challenge-c', title: 'Desafio C' }
      mockApi({ challenges: [DRAFT_CHALLENGE, C], deleteChallenge })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      // Edita A e dispara a exclusão de A (fica pendurada).
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0])

      // Enquanto a exclusão de A está em voo, o botão "Editar" da própria
      // linha de A fica desabilitado, mas o de C (outra linha) continua
      // livre — a profissional troca para editar C.
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título de C, não salvo' } })

      // A exclusão de A agora termina.
      resolveDelete({ error: null })
      await vi.waitFor(() => expect(deleteChallenge).toHaveBeenCalled())

      // A edição de C (mais nova que a exclusão de A) não pode ter sido
      // desfeita só porque A (que não é mais o editingId atual) foi excluído.
      expect(screen.getByRole('heading', { name: 'Editar desafio' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('Título de C, não salvo')
    })
  })
})

describe('GardenChallengeManager — integridade de formulários e prevenção de perda de dados (Etapa T)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('DayRow: "Cancelar" descarta o rascunho — reabrir "Editar" mostra os dados reais do dia, não o texto cancelado', () => {
    mockApi({ challenges: [CHALLENGE] })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Rascunho que será cancelado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText(DAY_1.title)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByPlaceholderText('Título da atividade')).toHaveValue(DAY_1.title)
  })

  describe('trocar de dia no composer de incentivo', () => {
    it('pede confirmação quando há mensagem digitada diferente do padrão do novo dia — cancelar mantém o dia e o texto atuais', () => {
      mockApi({ challenges: [CHALLENGE], daysByChallenge: { [CHALLENGE.id]: [DAY_1, DAY_2] } })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem só do dia 1.' },
      })
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_2.id } })

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Atividade do dia')).toHaveValue(DAY_1.id)
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem só do dia 1.')
      confirmSpy.mockRestore()
    })

    it('confirmando, troca para o novo dia e carrega sua mensagem padrão', () => {
      mockApi({
        challenges: [CHALLENGE],
        daysByChallenge: {
          [CHALLENGE.id]: [DAY_1, { ...DAY_2, encouragement_message: 'Mensagem padrão do dia 2.' }],
        },
      })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem só do dia 1.' },
      })
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_2.id } })

      expect(screen.getByLabelText('Atividade do dia')).toHaveValue(DAY_2.id)
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem padrão do dia 2.')
      confirmSpy.mockRestore()
    })

    it('não pede confirmação quando não há mensagem digitada', () => {
      mockApi({ challenges: [CHALLENGE], daysByChallenge: { [CHALLENGE.id]: [DAY_1, DAY_2] } })
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
      openIncentiveTab()

      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_2.id } })

      expect(confirmSpy).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('fechar/trocar de desafio expandido com mensagem de incentivo em composição', () => {
    it('clicar em "Fechar" pede confirmação quando há mensagem digitada não publicada — cancelar mantém o painel aberto e o texto', () => {
      mockApi({ challenges: [CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      openIncentiveTab()
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem em composição.' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem em composição.')
      confirmSpy.mockRestore()
    })

    it('confirmando, fecha o painel normalmente', () => {
      mockApi({ challenges: [CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      openIncentiveTab()
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem em composição.' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

      expect(screen.getByRole('button', { name: 'Gerenciar' })).toBeInTheDocument()
      confirmSpy.mockRestore()
    })

    it('expandir um desafio diferente também pede confirmação (a troca fecharia implicitamente o atual)', () => {
      mockApi({ challenges: [CHALLENGE, DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Gerenciar' })[0])
      fireEvent.click(screen.getByRole('button', { name: 'Publicar incentivo' }))
      fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
      fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
        target: { value: 'Mensagem em composição.' },
      })

      fireEvent.click(screen.getAllByRole('button', { name: 'Gerenciar' })[0])

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      // Cancelado: o painel do primeiro desafio continua aberto e preservado.
      expect(screen.getByLabelText('Mensagem de incentivo')).toHaveValue('Mensagem em composição.')
      confirmSpy.mockRestore()
    })

    it('não pede confirmação ao fechar/trocar quando não há mensagem digitada', () => {
      mockApi({ challenges: [CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

      expect(confirmSpy).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('trocar de desafio no formulário de criação/edição (topo do painel)', () => {
    it('clicar em "Editar" noutro desafio com edições não salvas pede confirmação — cancelar preserva o formulário atual', () => {
      mockApi({
        challenges: [DRAFT_CHALLENGE, { ...DRAFT_CHALLENGE, id: 'challenge-draft-2', title: 'Segundo rascunho' }],
      })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      const editButtons = screen.getAllByRole('button', { name: 'Editar' })
      fireEvent.click(editButtons[0])
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título alterado, não salvo' } })

      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Título')).toHaveValue('Título alterado, não salvo')
      confirmSpy.mockRestore()
    })

    it('abandonar um rascunho de "Criar desafio" (sem estar editando nenhum) também pede confirmação', () => {
      mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo desafio em criação' } })
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Título')).toHaveValue(DRAFT_CHALLENGE.title)
      confirmSpy.mockRestore()
    })

    it('não pede confirmação quando o formulário está limpo/sem alterações', () => {
      mockApi({ challenges: [DRAFT_CHALLENGE] })
      const confirmSpy = vi.spyOn(window, 'confirm')
      render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      expect(confirmSpy).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })
})

describe('GardenChallengeManager — edição de dia em andamento ao fechar/trocar de desafio (Etapa U)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  /** Expande o desafio, abre a aba "Dias" e começa a editar o primeiro dia. */
  function startEditingDay1() {
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Título editado, ainda não salvo' },
    })
  }

  it('fechar o desafio com um dia em edição e não salvo pede confirmação — cancelar mantém o painel, o dia em edição e os valores digitados', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    startEditingDay1()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Título da atividade')).toHaveValue('Título editado, ainda não salvo')
    confirmSpy.mockRestore()
  })

  it('confirmando, fecha o painel normalmente', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    startEditingDay1()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.getByRole('button', { name: 'Gerenciar' })).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('trocar para outro desafio com um dia em edição e não salvo também pede confirmação — cancelar preserva a edição no desafio atual', () => {
    mockApi({ challenges: [CHALLENGE, DRAFT_CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Gerenciar' })[0])
    // DRAFT_CHALLENGE (não expandido) também tem seu próprio botão "Editar" (nível
    // de desafio) — o primeiro "Editar" na ordem do DOM é o do dia, dentro do painel
    // já expandido de CHALLENGE, que aparece antes da linha de DRAFT_CHALLENGE.
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Título editado, ainda não salvo' },
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Gerenciar' })[0])

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByPlaceholderText('Título da atividade')).toHaveValue('Título editado, ainda não salvo')
    confirmSpy.mockRestore()
  })

  it('não pede confirmação ao fechar/trocar quando o dia está em edição mas nada foi alterado', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('não pede confirmação ao fechar/trocar quando nenhum dia está em edição', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('salvar o dia persiste os valores e encerra a edição sem precisar de confirmação ao fechar depois', async () => {
    const api = mockApi({ challenges: [CHALLENGE] })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    startEditingDay1()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await vi.waitFor(() => expect(api.updateDay).toHaveBeenCalledWith(
      CHALLENGE.id,
      DAY_1.id,
      expect.objectContaining({ title: 'Título editado, ainda não salvo' }),
    ))
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('Título da atividade')).not.toBeInTheDocument())

    const confirmSpy = vi.spyOn(window, 'confirm')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('cancelar a edição do dia restaura os valores originais, sem reapresentar o texto descartado ao fechar/reabrir depois', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    startEditingDay1()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText(DAY_1.title)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('múltiplas proteções simultâneas: dia em edição E mensagem de incentivo em composição exigem as duas confirmações — cancelar a segunda preserva tudo', () => {
    mockApi({ challenges: [CHALLENGE] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publicar incentivo' }))
    fireEvent.change(screen.getByLabelText('Atividade do dia'), { target: { value: DAY_1.id } })
    fireEvent.change(screen.getByLabelText('Mensagem de incentivo'), {
      target: { value: 'Mensagem em composição.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dias' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Título editado, ainda não salvo' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    // As duas proteções são checadas — a segunda (dia) não é pulada só porque
    // a primeira (incentivo) já foi confirmada; cancelá-la mantém o painel aberto.
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Título da atividade')).toHaveValue('Título editado, ainda não salvo')
    confirmSpy.mockRestore()
  })
})

describe('GardenChallengeManager — erro ao salvar a edição de um dia (Etapa W)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('Teste A — falha ao salvar: mostra o erro, mantém o formulário aberto com o texto digitado, e a edição continua não salva', async () => {
    const updateDay = vi.fn().mockResolvedValue({ error: 'Não foi possível salvar o dia agora.' })
    mockApi({ challenges: [CHALLENGE], updateDay })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Título editado, ainda não salvo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await vi.waitFor(() => expect(screen.getByText('Não foi possível salvar o dia agora.')).toBeInTheDocument())
    // Formulário permanece aberto, com o texto digitado intacto.
    expect(screen.getByPlaceholderText('Título da atividade')).toHaveValue('Título editado, ainda não salvo')

    // A edição continua identificada como não salva pelo fluxo já existente
    // (Etapa U): fechar o desafio ainda pede confirmação.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('Teste B — nova tentativa bem-sucedida: limpa o erro anterior e encerra a edição, preservando o comportamento de salvamento existente', async () => {
    const updateDay = vi
      .fn()
      .mockResolvedValueOnce({ error: 'Falha temporária.' })
      .mockResolvedValueOnce({ error: null })
    mockApi({ challenges: [CHALLENGE], updateDay })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByPlaceholderText('Título da atividade'), {
      target: { value: 'Título editado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await vi.waitFor(() => expect(screen.getByText('Falha temporária.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await vi.waitFor(() => expect(screen.queryByPlaceholderText('Título da atividade')).not.toBeInTheDocument())
    expect(screen.queryByText('Falha temporária.')).not.toBeInTheDocument()
    expect(updateDay).toHaveBeenCalledTimes(2)
    expect(updateDay).toHaveBeenCalledWith(
      CHALLENGE.id,
      DAY_1.id,
      expect.objectContaining({ title: 'Título editado' }),
    )
  })
})

const ENROLLMENT_1: GardenEnrollment = {
  id: 'enroll-1',
  challenge_id: CHALLENGE.id,
  profile_id: 'member-1',
  enrolled_at: '2026-10-19T00:00:00.000Z',
  profile: { id: 'member-1', full_name: 'Maria', avatar_url: null },
}

describe('GardenChallengeManager — erro ao carregar participantes/progresso (Etapa X)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  /** Expande o desafio e abre a aba "Participantes & progresso". */
  function openProgressTab() {
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Participantes & progresso' }))
  }

  it('carregamento em andamento mostra "Carregando..." e não antecipa "Ninguém se inscreveu ainda"', () => {
    mockApi({ challenges: [CHALLENGE], progressLoading: { [CHALLENGE.id]: true } })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    expect(screen.queryByText('Ninguém se inscreveu ainda.')).not.toBeInTheDocument()
  })

  it('falha ao carregar participantes mostra um erro claro, sem "Ninguém se inscreveu ainda" e com opção de tentar novamente', () => {
    mockApi({ challenges: [CHALLENGE], participantsError: { [CHALLENGE.id]: 'Falha de rede.' } })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText(/Falha de rede\./)).toBeInTheDocument()
    expect(screen.queryByText('Ninguém se inscreveu ainda.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('falha só nas conclusões (participantes carregaram) também é tratada como erro da aba — não mostra contagens não confiáveis', () => {
    mockApi({
      challenges: [CHALLENGE],
      participantsByChallenge: { [CHALLENGE.id]: [ENROLLMENT_1] },
      completionsError: { [CHALLENGE.id]: 'Falha ao buscar conclusões.' },
    })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText(/Falha ao buscar conclusões\./)).toBeInTheDocument()
    // As contagens "X/Y dias" dependem diretamente de `completions` — com ela
    // falha, não renderiza a lista como se os números fossem confiáveis.
    expect(screen.queryByText('Maria')).not.toBeInTheDocument()
  })

  it('quando as duas buscas falham, mostra só uma mensagem de erro (a de participantes), sem duplicar', () => {
    mockApi({
      challenges: [CHALLENGE],
      participantsError: { [CHALLENGE.id]: 'Erro ao buscar participantes.' },
      completionsError: { [CHALLENGE.id]: 'Erro ao buscar conclusões.' },
    })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText(/Erro ao buscar participantes\./)).toBeInTheDocument()
    expect(screen.queryByText(/Erro ao buscar conclusões\./)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(1)
  })

  it('clicar em "Tentar novamente" refaz a busca de progresso do mesmo desafio', () => {
    const fetchProgress = vi.fn()
    mockApi({
      challenges: [CHALLENGE],
      participantsError: { [CHALLENGE.id]: 'Falha de rede.' },
      fetchProgress,
    })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(fetchProgress).toHaveBeenCalledWith(CHALLENGE.id)
    // Uma vez ao abrir a aba (openTab) e outra ao clicar em "Tentar novamente".
    expect(fetchProgress).toHaveBeenCalledTimes(2)
  })

  it('carregamento concluído sem participantes mantém a mensagem de lista vazia, sem erro (regressão)', () => {
    mockApi({ challenges: [CHALLENGE], participantsByChallenge: { [CHALLENGE.id]: [] } })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText('Ninguém se inscreveu ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('carregamento concluído com participantes preserva a exibição de progresso (regressão)', () => {
    mockApi({
      challenges: [CHALLENGE],
      participantsByChallenge: { [CHALLENGE.id]: [ENROLLMENT_1] },
      completionsByChallenge: { [CHALLENGE.id]: [] },
    })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    openProgressTab()

    expect(screen.getByText(`Maria — 0/${CHALLENGE.duration_days} dias`)).toBeInTheDocument()
  })
})

describe('GardenChallengeManager — acessibilidade dos campos de edição de um dia (Etapa Y)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('os 4 campos do dia têm rótulos acessíveis corretamente associados (getByLabelText), e o campo encontrado pelo rótulo é o mesmo usado para salvar', async () => {
    const updateDay = vi.fn().mockResolvedValue({ error: null })
    mockApi({ challenges: [CHALLENGE], updateDay })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    // getByLabelText só encontra o campo se o <label htmlFor> apontar para o
    // id certo — isto já comprova a associação, não só a presença do texto.
    const titleInput = screen.getByLabelText('Título do dia')
    expect(titleInput).toHaveValue(DAY_1.title)
    expect(screen.getByLabelText('Instruções')).toBeInTheDocument()
    expect(screen.getByLabelText('Ícone')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem de incentivo')).toBeInTheDocument()

    // O campo achado pelo rótulo é o campo real do formulário: editar por
    // ele e salvar chama updateDay com o valor digitado ali.
    fireEvent.change(titleInput, { target: { value: 'Título editado via rótulo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await vi.waitFor(() =>
      expect(updateDay).toHaveBeenCalledWith(
        CHALLENGE.id,
        DAY_1.id,
        expect.objectContaining({ title: 'Título editado via rótulo' }),
      ),
    )
  })

  it('placeholders úteis continuam presentes como dica complementar, não como substituto do rótulo', () => {
    mockApi({ challenges: [CHALLENGE] })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    // O mesmo elemento é alcançável tanto pelo rótulo (associação
    // acessível) quanto pelo placeholder (dica visual preservada).
    expect(screen.getByLabelText('Ícone')).toBe(screen.getByPlaceholderText('Ícone (ex.: 🌱)'))
  })

  it('rótulos permanecem corretamente associados quando dois dias estão em edição simultaneamente (ids únicos por dia)', () => {
    mockApi({ challenges: [CHALLENGE], daysByChallenge: { [CHALLENGE.id]: [DAY_1, DAY_2] } })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar' }))

    const editButtons = screen.getAllByRole('button', { name: 'Editar' })
    fireEvent.click(editButtons[0])
    fireEvent.click(editButtons[1])

    const titleInputs = screen.getAllByLabelText('Título do dia')
    expect(titleInputs).toHaveLength(2)
    expect(titleInputs[0]).toHaveValue(DAY_1.title)
    expect(titleInputs[1]).toHaveValue(DAY_2.title)
    expect(titleInputs[0].id).not.toBe(titleInputs[1].id)

    const instructionsInputs = screen.getAllByLabelText('Instruções')
    expect(instructionsInputs).toHaveLength(2)
    expect(instructionsInputs[0].id).not.toBe(instructionsInputs[1].id)
  })
})

describe('GardenChallengeManager — erro ao carregar a lista de desafios (Etapa AA — Finding 1)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra a mensagem de erro e um botão "Tentar novamente" quando error está preenchido', () => {
    mockApi({ error: 'Falha de rede' })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    expect(screen.getByText('Falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('chama api.refresh ao clicar em "Tentar novamente"', () => {
    const api = mockApi({ error: 'Falha de rede' })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(api.refresh).toHaveBeenCalledTimes(1)
  })

  it('não mostra a lista de desafios nem a mensagem de lista vazia enquanto houver erro', () => {
    mockApi({ error: 'Falha de rede' })
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    expect(screen.queryByText('Desafio de teste')).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhum desafio criado ainda.')).not.toBeInTheDocument()
  })

  it('sem erro, não mostra o botão "Tentar novamente" da lista de desafios', () => {
    mockApi()
    render(<GardenChallengeManager communityId="community-1" profileId="prof-1" />)

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })
})
