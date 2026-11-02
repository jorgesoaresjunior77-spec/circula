// Link de convite da comunidade (WhatsApp): `?convite=<token>` na URL
// pública do app. O token é lido uma vez, guardado no navegador (para
// sobreviver ao cadastro, a um login e a uma eventual confirmação de
// e-mail) e removido da barra de endereço.
const STORAGE_KEY = 'circula.invite-token'
const QUERY_PARAM = 'convite'
// o servidor gera 64 hex; aceitamos um pouco mais, só para barrar lixo
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export function isValidInviteToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

export function readInviteToken(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isValidInviteToken(value) ? value : null
  } catch {
    return null
  }
}

export function clearInviteToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // navegador sem storage: o token só vale nesta sessão da página
  }
}

/** Lê `?convite=` da URL, guarda e limpa a barra de endereço. */
export function captureInviteTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href)
    const fromUrl = url.searchParams.get(QUERY_PARAM)
    if (fromUrl !== null) {
      if (isValidInviteToken(fromUrl)) window.localStorage.setItem(STORAGE_KEY, fromUrl)
      url.searchParams.delete(QUERY_PARAM)
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      if (isValidInviteToken(fromUrl)) return fromUrl
    }
  } catch {
    // URL/storage indisponíveis: cai para o que já estiver guardado
  }
  return readInviteToken()
}

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?${QUERY_PARAM}=${encodeURIComponent(token)}`
}
