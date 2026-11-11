import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { DailyInspiration } from './DailyInspiration'

const rows: unknown[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: rows, error: null }),
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

const POPUP = { name: 'Mensagem do dia' }
const FECHAR = { name: 'Fechar mensagem do dia' }

describe('DailyInspiration — popup só ao abrir o app', () => {
  afterEach(() => {
    cleanup()
    rows.length = 0
    vi.useRealTimers()
  })

  it('ao abrir o app mostra a mensagem em popup, com autor e obra', async () => {
    rows.push(CITACAO)
    render(<DailyInspiration communityId="c1" />)

    expect(await screen.findByRole('dialog', POPUP)).toBeInTheDocument()
    expect(screen.getByText('“Uma frase com fonte.”')).toBeInTheDocument()
    expect(screen.getByText('Autora Teste, Obra Teste')).toBeInTheDocument()
    expect(screen.getByRole('button', FECHAR)).toBeInTheDocument()
  })

  it('fecha no X e depois some: nada fica na Home', async () => {
    rows.push(CITACAO)
    const { container } = render(<DailyInspiration communityId="c1" />)

    fireEvent.click(await screen.findByRole('button', FECHAR))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
    expect(document.querySelector('.inspiration-ticker')).toBeNull()
  })

  it('fecha com Esc e tocando fora, mas não ao tocar no próprio popup', async () => {
    rows.push(CITACAO)
    const { unmount } = render(<DailyInspiration communityId="c1" />)
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<DailyInspiration communityId="c1" />)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('depois de alguns segundos o popup fecha sozinho', async () => {
    rows.push(CITACAO)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<DailyInspiration communityId="c1" />)
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7100)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abrir o app de novo mostra a mensagem de novo (ela não fica guardada como vista)', async () => {
    rows.push(CITACAO)
    const first = render(<DailyInspiration communityId="c1" />)
    fireEvent.click(await screen.findByRole('button', FECHAR))
    first.unmount()

    render(<DailyInspiration communityId="c1" />)
    expect(await screen.findByRole('dialog', POPUP)).toBeInTheDocument()
  })

  it('texto editorial é identificado como do Círcula', async () => {
    rows.push({ ...CITACAO, kind: 'editorial', author: null, source: null, body: 'Respire fundo.' })
    render(<DailyInspiration communityId="c1" />)

    expect(await screen.findByText('Respire fundo.')).toBeInTheDocument()
    expect(screen.getByText('Texto editorial do Círcula')).toBeInTheDocument()
  })

  it('mensagem do status "auto" (biblioteca automática) também aparece', async () => {
    rows.push({ ...CITACAO, status: 'auto' })
    render(<DailyInspiration communityId="c1" />)
    expect(await screen.findByRole('dialog', POPUP)).toBeInTheDocument()
  })

  it('sem mensagem publicada, nada aparece', async () => {
    render(<DailyInspiration communityId="c1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('espera outro modal (onboarding, tour, guia) terminar', async () => {
    rows.push(CITACAO)
    const { rerender } = render(<DailyInspiration communityId="c1" suppressed />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<DailyInspiration communityId="c1" suppressed={false} />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
