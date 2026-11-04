import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CommunityInviteWhatsApp, InviteMessageComposer } from './CommunityInviteWhatsApp'
import { useInviteLink } from '../hooks/useInviteLink'

vi.mock('../hooks/useInviteLink')

const INVITE_URL = 'https://app.test/circula/?convite=abc123abc123abc123abc123'

// Etapa 4 (evolução/gamificação) — garante que: (1) a mensagem inicial
// contém o nome real da comunidade e o link de convite (nunca um
// placeholder genérico); (2) trocar de sugestão SUBSTITUI o texto (nunca
// concatena) e o texto continua 100% editável depois; (3) "Copiar
// mensagem" chama navigator.clipboard.writeText com o texto ATUAL do
// campo (não a sugestão original, se a pessoa já editou); (4)
// "Compartilhar no WhatsApp" abre `https://wa.me/?text=...` com o texto
// atual codificado — nunca afirma envio, só abre o link.
describe('CommunityInviteWhatsApp', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('pré-preenche a mensagem com o nome da comunidade e o link de convite', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    expect(textarea.value).toContain('Fluir & Florescer')
    expect(textarea.value).toContain(INVITE_URL)
  })

  it('trocar de sugestão substitui o texto, e o campo continua editável', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    const firstMessage = textarea.value

    fireEvent.click(screen.getByText('Sugestão 2'))
    expect(textarea.value).not.toBe(firstMessage)
    expect(textarea.value).toContain('Fluir & Florescer')

    fireEvent.change(textarea, { target: { value: 'Mensagem minha, escrita do zero.' } })
    expect(textarea.value).toBe('Mensagem minha, escrita do zero.')
  })

  it('copia exatamente o texto atual do campo (já editado), não a sugestão original', async () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const textarea = screen.getByLabelText('Mensagem')
    fireEvent.change(textarea, { target: { value: 'Texto editado pela profissional.' } })

    fireEvent.click(screen.getByText('Copiar mensagem'))
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Texto editado pela profissional.')
    })
  })

  it('compartilhar abre um link wa.me com o texto atual codificado, sem afirmar envio', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const textarea = screen.getByLabelText('Mensagem')
    fireEvent.change(textarea, { target: { value: 'Oi! Vem pro Círcula.' } })

    fireEvent.click(screen.getByText('Compartilhar no WhatsApp'))

    expect(window.open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent('Oi! Vem pro Círcula.')}`,
      '_blank',
      'noopener,noreferrer',
    )
    expect(screen.queryByText(/mensagem enviada/i)).not.toBeInTheDocument()
  })

  it('enviar pelo WhatsApp fica desabilitado sem número e abre a conversa do número digitado', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const send = screen.getByText('Enviar pelo WhatsApp')
    expect(send).toBeDisabled()

    fireEvent.change(screen.getByLabelText('WhatsApp da pessoa'), { target: { value: '(51) 99999-8888' } })
    expect(send).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Oi! Vem pro Círcula.' } })
    fireEvent.click(send)

    expect(window.open).toHaveBeenCalledWith(
      `https://wa.me/5551999998888?text=${encodeURIComponent('Oi! Vem pro Círcula.')}`,
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('número inválido mostra aviso e não deixa enviar', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    fireEvent.change(screen.getByLabelText('WhatsApp da pessoa'), { target: { value: '12345' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Número inválido')
    expect(screen.getByText('Enviar pelo WhatsApp')).toBeDisabled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('desabilita copiar/compartilhar quando a mensagem fica vazia', () => {
    render(<InviteMessageComposer communityName="Fluir & Florescer" inviteUrl={INVITE_URL} />)

    const textarea = screen.getByLabelText('Mensagem')
    fireEvent.change(textarea, { target: { value: '   ' } })

    expect(screen.getByText('Copiar mensagem')).toBeDisabled()
    expect(screen.getByText('Compartilhar no WhatsApp')).toBeDisabled()
  })
})

function mockLink(overrides: Partial<ReturnType<typeof useInviteLink>>) {
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

describe('CommunityInviteWhatsApp — link de convite', () => {
  afterEach(() => cleanup())

  it('sem link ativo oferece gerar um, e não mostra o campo de mensagem', () => {
    const link = mockLink({})
    render(<CommunityInviteWhatsApp communityId="c1" communityName="Fluir & Florescer" />)

    expect(screen.queryByLabelText('Mensagem')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Gerar link de convite'))
    expect(link.create).toHaveBeenCalled()
  })

  it('com link ativo monta a mensagem com o link e permite gerar outro ou desativar', () => {
    const link = mockLink({ token: 'abc123abc123abc123abc123', url: INVITE_URL })
    render(<CommunityInviteWhatsApp communityId="c1" communityName="Fluir & Florescer" />)

    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain(INVITE_URL)

    fireEvent.click(screen.getByText('Gerar um novo link'))
    expect(link.regenerate).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Desativar link'))
    expect(link.revoke).toHaveBeenCalled()
  })

  it('autoCreate gera o link sozinho quando não há link ativo', () => {
    const link = mockLink({})
    render(<CommunityInviteWhatsApp communityId="c1" communityName="Fluir & Florescer" autoCreate showTitle={false} />)

    expect(link.create).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('heading', { name: 'Convidar pelo WhatsApp' })).not.toBeInTheDocument()
  })

  it('autoCreate não gera outro link quando já existe um ativo', () => {
    const link = mockLink({ token: 'abc123abc123abc123abc123', url: INVITE_URL })
    render(<CommunityInviteWhatsApp communityId="c1" communityName="Fluir & Florescer" autoCreate />)

    expect(link.create).not.toHaveBeenCalled()
  })

  it('mostra a falha de carregamento sem quebrar', () => {
    mockLink({ error: 'Não foi possível carregar o link de convite.' })
    render(<CommunityInviteWhatsApp communityId="c1" communityName="Fluir & Florescer" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar')
  })
})
