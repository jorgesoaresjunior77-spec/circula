import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PanelInviteCta } from './PanelInviteCta'
import { useInviteLink } from '../hooks/useInviteLink'

vi.mock('../hooks/useInviteLink')

const INVITE_URL = 'https://app.test/circula/?convite=abc123abc123abc123abc123'

function mockLink(overrides: Partial<ReturnType<typeof useInviteLink>> = {}) {
  const base = {
    token: null,
    url: null,
    loading: false,
    busy: false,
    error: null,
    create: vi.fn(),
    regenerate: vi.fn(),
    revoke: vi.fn(),
  }
  vi.mocked(useInviteLink).mockReturnValue({ ...base, ...overrides })
  return { ...base, ...overrides }
}

describe('PanelInviteCta', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('começa fechado: só o botão, sem criar link nem mostrar o campo de número', () => {
    const link = mockLink()
    render(<PanelInviteCta communityId="c1" communityName="Fluir & Florescer" />)

    expect(screen.getByRole('button', { name: /Convidar pelo WhatsApp/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('WhatsApp da pessoa')).not.toBeInTheDocument()
    expect(link.create).not.toHaveBeenCalled()
  })

  it('ao abrir, mostra o número e a mensagem com o link da comunidade', () => {
    mockLink({ token: 'abc123abc123abc123abc123', url: INVITE_URL })
    render(<PanelInviteCta communityId="c1" communityName="Fluir & Florescer" />)

    fireEvent.click(screen.getByRole('button', { name: /Convidar pelo WhatsApp/ }))

    expect(screen.getByLabelText('WhatsApp da pessoa')).toBeInTheDocument()
    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain(INVITE_URL)
    expect(screen.getByRole('button', { name: /Fechar convite/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('ao abrir sem link ativo, já gera o link da comunidade', () => {
    const link = mockLink()
    render(<PanelInviteCta communityId="c1" communityName="Fluir & Florescer" />)

    fireEvent.click(screen.getByRole('button', { name: /Convidar pelo WhatsApp/ }))

    expect(link.create).toHaveBeenCalledTimes(1)
  })

  it('fechar esconde o formulário de novo', () => {
    mockLink({ token: 'abc123abc123abc123abc123', url: INVITE_URL })
    render(<PanelInviteCta communityId="c1" communityName="Fluir & Florescer" />)

    fireEvent.click(screen.getByRole('button', { name: /Convidar pelo WhatsApp/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fechar convite/ }))

    expect(screen.queryByLabelText('WhatsApp da pessoa')).not.toBeInTheDocument()
  })
})
