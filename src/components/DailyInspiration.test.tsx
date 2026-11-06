import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { DailyInspiration } from './DailyInspiration'

const rows: unknown[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  },
}))

const CITACAO = {
  id: 'i1',
  community_id: 'c1',
  kind: 'citacao',
  body: 'Uma frase com fonte.',
  author: 'Autora Teste',
  source: 'Obra Teste',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
}

describe('DailyInspiration — pop-up diário', () => {
  beforeEach(() => {
    rows.length = 0
    window.localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('mostra a citação com autor e obra, com botão X', async () => {
    rows.push(CITACAO)
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    expect(await screen.findByRole('dialog', { name: 'Mensagem do dia' })).toBeInTheDocument()
    expect(screen.getByText('“Uma frase com fonte.”')).toBeInTheDocument()
    expect(screen.getByText('Autora Teste, Obra Teste')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('texto editorial é identificado como do Círcula', async () => {
    rows.push({ ...CITACAO, kind: 'editorial', author: null, source: null, body: 'Respire fundo.' })
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    expect(await screen.findByText('Respire fundo.')).toBeInTheDocument()
    expect(screen.getByText('Texto editorial do Círcula')).toBeInTheDocument()
  })

  it('fecha no X e não volta no mesmo dia', async () => {
    rows.push(CITACAO)
    const { unmount } = render(<DailyInspiration communityId="c1" profileId="u1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<DailyInspiration communityId="c1" profileId="u1" />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('fecha com Esc', async () => {
    rows.push(CITACAO)
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sem mensagem publicada, nada aparece', async () => {
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('espera outro modal (onboarding, tour, guia) terminar', async () => {
    rows.push(CITACAO)
    const { rerender } = render(<DailyInspiration communityId="c1" profileId="u1" suppressed />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<DailyInspiration communityId="c1" profileId="u1" suppressed={false} />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('outra pessoa no mesmo aparelho vê a sua própria mensagem do dia', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem('circula:daily-inspiration:u1', '2026-11-05')
    render(<DailyInspiration communityId="c1" profileId="u2" />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
