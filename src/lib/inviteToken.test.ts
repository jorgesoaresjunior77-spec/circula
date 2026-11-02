import { describe, it, expect, beforeEach } from 'vitest'
import { buildInviteUrl, captureInviteTokenFromUrl, clearInviteToken, isValidInviteToken, readInviteToken } from './inviteToken'

const TOKEN = 'a'.repeat(64)

describe('inviteToken', () => {
  beforeEach(() => {
    clearInviteToken()
    window.history.replaceState(null, '', '/circula/')
  })

  it('lê ?convite=, guarda e limpa a barra de endereço', () => {
    window.history.replaceState(null, '', `/circula/?convite=${TOKEN}`)
    expect(captureInviteTokenFromUrl()).toBe(TOKEN)
    expect(window.location.search).toBe('')
    expect(readInviteToken()).toBe(TOKEN)
  })

  it('sem parâmetro devolve o que já estava guardado (sobrevive a recarregar/login)', () => {
    window.history.replaceState(null, '', `/circula/?convite=${TOKEN}`)
    captureInviteTokenFromUrl()
    expect(captureInviteTokenFromUrl()).toBe(TOKEN)
    clearInviteToken()
    expect(captureInviteTokenFromUrl()).toBeNull()
  })

  it('ignora token com formato inválido', () => {
    window.history.replaceState(null, '', '/circula/?convite=<script>')
    expect(captureInviteTokenFromUrl()).toBeNull()
    expect(isValidInviteToken('curto')).toBe(false)
  })

  it('monta o link com a base do app', () => {
    expect(buildInviteUrl(TOKEN)).toBe(`${window.location.origin}${import.meta.env.BASE_URL}?convite=${TOKEN}`)
  })
})
