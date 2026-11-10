import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
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
const SEEN_KEY = (profile: string) => `circula:daily-inspiration:${profile}`

describe('DailyInspiration — popup e letreiro', () => {
  beforeEach(() => {
    rows.length = 0
    window.localStorage.clear()
    // O letreiro é desenhado dentro da saudação da Home, no encaixe #daily-ticker-slot.
    const slot = document.createElement('div')
    slot.id = 'daily-ticker-slot'
    document.body.appendChild(slot)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
  })

  afterEach(() => {
    cleanup()
    document.getElementById('daily-ticker-slot')?.remove()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('na primeira abertura do dia mostra a mensagem em popup, com autor e obra', async () => {
    rows.push(CITACAO)
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    expect(await screen.findByRole('dialog', POPUP)).toBeInTheDocument()
    expect(screen.getByText('“Uma frase com fonte.”')).toBeInTheDocument()
    expect(screen.getByText('Autora Teste, Obra Teste')).toBeInTheDocument()
    expect(screen.getByRole('button', FECHAR)).toBeInTheDocument()
    // Ainda não virou balão.
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('ao fechar o popup no X, a mensagem passa para o letreiro no topo', async () => {
    rows.push(CITACAO)
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    fireEvent.click(await screen.findByRole('button', FECHAR))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const balao = await screen.findByRole('note', POPUP)
    expect(balao).toBeInTheDocument()
    expect(document.getElementById('daily-ticker-slot')).toContainElement(balao)
    expect(screen.getAllByText(/Uma frase com fonte/).length).toBeGreaterThan(0)
  })

  it('o popup também fecha com Esc e com toque fora', async () => {
    rows.push(CITACAO)
    const { unmount } = render(<DailyInspiration communityId="c1" profileId="u1" />)
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('note')).toBeInTheDocument()
    unmount()

    window.localStorage.clear()
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    const dialog = await screen.findByRole('dialog')
    // Toque no próprio popup não fecha; no fundo, fecha.
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('depois de alguns segundos, o popup vai sozinho para o topo', async () => {
    rows.push(CITACAO)
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7100)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('nas outras aberturas do dia aparece só o balão, sem popup', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    expect(await screen.findByRole('note', POPUP)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o X do balão o esconde pelo resto do dia', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    const { unmount } = render(<DailyInspiration communityId="c1" profileId="u1" />)
    fireEvent.click(await screen.findByRole('button', FECHAR))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    unmount()

    render(<DailyInspiration communityId="c1" profileId="u1" />)
    await new Promise((r) => setTimeout(r, 0))
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('texto editorial é identificado como do Círcula', async () => {
    rows.push({ ...CITACAO, kind: 'editorial', author: null, source: null, body: 'Respire fundo.' })
    render(<DailyInspiration communityId="c1" profileId="u1" />)

    expect(await screen.findByText('Respire fundo.')).toBeInTheDocument()
    expect(screen.getByText('Texto editorial do Círcula')).toBeInTheDocument()
  })

  it('mensagem do status "auto" (biblioteca automática) também aparece', async () => {
    rows.push({ ...CITACAO, status: 'auto' })
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    expect(await screen.findByRole('dialog', POPUP)).toBeInTheDocument()
  })

  it('sem mensagem publicada, nada aparece', async () => {
    render(<DailyInspiration communityId="c1" profileId="u1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('espera outro modal (onboarding, tour, guia) terminar', async () => {
    rows.push(CITACAO)
    const { rerender } = render(<DailyInspiration communityId="c1" profileId="u1" suppressed />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<DailyInspiration communityId="c1" profileId="u1" suppressed={false} />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('outra pessoa no mesmo aparelho vê o seu próprio popup do dia', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    render(<DailyInspiration communityId="c1" profileId="u2" />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('o letreiro mostra a frase inteira, com autor e obra, numa linha que desliza', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    const { container } = render(<DailyInspiration communityId="c1" profileId="u1" />)
    await screen.findByRole('note', POPUP)
    const items = container.ownerDocument.querySelectorAll('.inspiration-ticker-item')
    // Duas cópias (a segunda é só para o laço contínuo e some para leitores de tela).
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('“Uma frase com fonte.” — Autora Teste, Obra Teste')
    expect(items[1]).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector<HTMLElement>('.inspiration-ticker-track')?.style.animationDuration).toMatch(/s$/)
  })

  it('a profissional ganha o atalho Gerenciar no letreiro', async () => {
    rows.push(CITACAO)
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    const onManage = vi.fn()
    render(<DailyInspiration communityId="c1" profileId="u1" onManage={onManage} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar' }))
    expect(onManage).toHaveBeenCalledTimes(1)
  })

  it('sem mensagem para hoje, só a profissional vê a faixa com o atalho', async () => {
    window.localStorage.setItem(SEEN_KEY('u1'), '2026-11-05')
    const { unmount } = render(<DailyInspiration communityId="c1" profileId="u1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    unmount()

    render(<DailyInspiration communityId="c1" profileId="u1" onManage={() => {}} />)
    expect(await screen.findByText('Nenhuma mensagem publicada para hoje.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerenciar' })).toBeInTheDocument()
  })
})
