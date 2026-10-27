import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { GardenIncentiveCard, GardenIncentiveMessageLibrary } from './GardenIncentiveTemplates'
import { GARDEN_INCENTIVE_TEMPLATES, GARDEN_INCENTIVE_MESSAGE_LIBRARY } from '../types/garden'
import type { GardenIncentiveTemplateKey } from '../types/garden'

describe('GARDEN_INCENTIVE_TEMPLATES — catálogo', () => {
  it('tem exatamente seis templates, cada um com chave, rótulo, eyebrow, emoji e dica únicos', () => {
    expect(GARDEN_INCENTIVE_TEMPLATES).toHaveLength(6)

    const keys = GARDEN_INCENTIVE_TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(6) // sem chave duplicada

    for (const template of GARDEN_INCENTIVE_TEMPLATES) {
      expect(template.label.length).toBeGreaterThan(0)
      expect(template.eyebrow.length).toBeGreaterThan(0)
      expect(template.emoji.length).toBeGreaterThan(0)
      expect(template.hint.length).toBeGreaterThan(0)
    }
  })
})

describe('GardenIncentiveCard', () => {
  afterEach(() => {
    cleanup()
  })

  it.each(GARDEN_INCENTIVE_TEMPLATES.map((t) => t.key))(
    'renderiza o template "%s" com título e mensagem reais, sem inventar conteúdo',
    (key: GardenIncentiveTemplateKey) => {
      const { container } = render(
        <GardenIncentiveCard template={key} title="Dia 3 — alongamento" message="Hoje foi só respirar fundo e se alongar." />,
      )

      expect(screen.getByText('Dia 3 — alongamento')).toBeInTheDocument()
      expect(screen.getByText('Hoje foi só respirar fundo e se alongar.')).toBeInTheDocument()
      expect(container.querySelector(`.garden-incentive-template--${key}`)).toBeInTheDocument()
    },
  )

  it('mostra a autora quando informada, e nada quando ausente', () => {
    const { rerender } = render(
      <GardenIncentiveCard template="motivacao" title="Título" message="Mensagem" authorName="Nutri Marluce" />,
    )
    expect(screen.getByText('Nutri Marluce')).toBeInTheDocument()

    rerender(<GardenIncentiveCard template="motivacao" title="Título" message="Mensagem" />)
    expect(screen.queryByText('Nutri Marluce')).not.toBeInTheDocument()
  })

  it('não renderiza o parágrafo de mensagem quando ela é vazia/só espaços (não inventa conteúdo)', () => {
    const { container } = render(<GardenIncentiveCard template="celebracao" title="Título" message="   " />)

    expect(container.querySelector('.garden-incentive-template-message')).not.toBeInTheDocument()
  })

  it('cada template usa seu próprio eyebrow (hierarquia/identidade visual distinta por categoria)', () => {
    render(<GardenIncentiveCard template="acolhimento" title="T" message="M" />)
    expect(screen.getByText('Acolhimento')).toBeInTheDocument()

    cleanup()

    render(<GardenIncentiveCard template="conquista" title="T" message="M" />)
    expect(screen.getByText('Conquista')).toBeInTheDocument()
  })

  it('template nulo (Etapa P) renderiza pré-visualização neutra, sem classe nem eyebrow de categoria', () => {
    const { container } = render(<GardenIncentiveCard template={null} title="T" message="M" />)
    expect(container.querySelector('.garden-incentive-template')).not.toBeNull()
    expect(container.querySelector('[class*="garden-incentive-template--"]')).toBeNull()
    expect(screen.getByText('Sem estilo')).toBeInTheDocument()
  })
})

describe('GARDEN_INCENTIVE_MESSAGE_LIBRARY — biblioteca de mensagens (Etapa Q)', () => {
  const FORBIDDEN_TERMS = ['emagre', 'peso', 'dieta', 'gordura', 'cura', 'garante', 'garant']

  it('tem sugestões para cada uma das seis categorias, sem mensagens vazias, duplicadas ou repetidas entre categorias', () => {
    const keys = GARDEN_INCENTIVE_TEMPLATES.map((t) => t.key)
    expect(Object.keys(GARDEN_INCENTIVE_MESSAGE_LIBRARY).sort()).toEqual([...keys].sort())

    const allMessages: string[] = []
    for (const key of keys) {
      const messages = GARDEN_INCENTIVE_MESSAGE_LIBRARY[key]
      expect(messages.length).toBeGreaterThanOrEqual(3)
      for (const message of messages) {
        expect(message.trim().length).toBeGreaterThan(10)
        allMessages.push(message)
      }
      expect(new Set(messages).size).toBe(messages.length) // sem repetição dentro da categoria
    }
    expect(new Set(allMessages).size).toBe(allMessages.length) // sem repetição entre categorias
  })

  it('evita linguagem de promessa de emagrecimento, pressão estética ou alegação médica', () => {
    for (const messages of Object.values(GARDEN_INCENTIVE_MESSAGE_LIBRARY)) {
      for (const message of messages) {
        const normalized = message.toLowerCase()
        for (const term of FORBIDDEN_TERMS) {
          expect(normalized).not.toContain(term)
        }
      }
    }
  })
})

describe('GardenIncentiveMessageLibrary', () => {
  afterEach(() => {
    cleanup()
  })

  it('mostra o eyebrow da categoria e o texto completo de cada sugestão', () => {
    render(<GardenIncentiveMessageLibrary template="acolhimento" onApply={vi.fn()} />)

    expect(screen.getByText('Sugestões de mensagem — Acolhimento')).toBeInTheDocument()
    for (const message of GARDEN_INCENTIVE_MESSAGE_LIBRARY.acolhimento) {
      expect(screen.getByText(message)).toBeInTheDocument()
    }
  })

  it('consultar a lista não chama onApply — só o clique em "Usar esta sugestão" aplica', () => {
    const onApply = vi.fn()
    render(<GardenIncentiveMessageLibrary template="conquista" onApply={onApply} />)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('clicar em "Usar esta sugestão" chama onApply com o texto exato daquela sugestão', () => {
    const onApply = vi.fn()
    render(<GardenIncentiveMessageLibrary template="conquista" onApply={onApply} />)

    const [first, second] = GARDEN_INCENTIVE_MESSAGE_LIBRARY.conquista
    const firstItem = screen.getByText(first).closest('li')
    expect(firstItem).not.toBeNull()
    fireEvent.click(within(firstItem as HTMLElement).getByRole('button', { name: 'Usar esta sugestão' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(first)
    expect(onApply).not.toHaveBeenCalledWith(second)
  })
})
