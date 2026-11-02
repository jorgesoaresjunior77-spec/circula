import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CommunityInviteWhatsApp } from './CommunityInviteWhatsApp'

// Etapa 4 (evolução/gamificação) — garante que: (1) a mensagem inicial
// contém o nome real da comunidade e a URL pública do app (nunca um
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

  it('pré-preenche a mensagem com o nome da comunidade e a URL pública do app', () => {
    render(<CommunityInviteWhatsApp communityName="Fluir & Florescer" />)

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    expect(textarea.value).toContain('Fluir & Florescer')
    expect(textarea.value).toContain(window.location.origin)
  })

  it('trocar de sugestão substitui o texto, e o campo continua editável', () => {
    render(<CommunityInviteWhatsApp communityName="Fluir & Florescer" />)

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    const firstMessage = textarea.value

    fireEvent.click(screen.getByText('Sugestão 2'))
    expect(textarea.value).not.toBe(firstMessage)
    expect(textarea.value).toContain('Fluir & Florescer')

    fireEvent.change(textarea, { target: { value: 'Mensagem minha, escrita do zero.' } })
    expect(textarea.value).toBe('Mensagem minha, escrita do zero.')
  })

  it('copia exatamente o texto atual do campo (já editado), não a sugestão original', async () => {
    render(<CommunityInviteWhatsApp communityName="Fluir & Florescer" />)

    const textarea = screen.getByLabelText('Mensagem')
    fireEvent.change(textarea, { target: { value: 'Texto editado pela profissional.' } })

    fireEvent.click(screen.getByText('Copiar mensagem'))
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Texto editado pela profissional.')
    })
  })

  it('compartilhar abre um link wa.me com o texto atual codificado, sem afirmar envio', () => {
    render(<CommunityInviteWhatsApp communityName="Fluir & Florescer" />)

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

  it('desabilita copiar/compartilhar quando a mensagem fica vazia', () => {
    render(<CommunityInviteWhatsApp communityName="Fluir & Florescer" />)

    const textarea = screen.getByLabelText('Mensagem')
    fireEvent.change(textarea, { target: { value: '   ' } })

    expect(screen.getByText('Copiar mensagem')).toBeDisabled()
    expect(screen.getByText('Compartilhar no WhatsApp')).toBeDisabled()
  })
})
