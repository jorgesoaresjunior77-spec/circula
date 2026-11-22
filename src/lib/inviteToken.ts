// Link de convite da comunidade (WhatsApp): `?convite=<token>` na URL
// pública do app. O token é lido uma vez, guardado no navegador (para
// sobreviver ao cadastro, a um login e a uma eventual confirmação de
// e-mail) e removido da barra de endereço.
const STORAGE_KEY = 'circula.invite-token'
const QUERY_PARAM = 'convite'
const REF_PARAM = 'ref'
const REF_KEY = 'circula.invite-ref'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

/** Quem indicou (id de perfil) guardado junto do convite, ou null. */
export function readInviteRef(): string | null {
  try {
    const value = window.localStorage.getItem(REF_KEY)
    return value && UUID_PATTERN.test(value) ? value : null
  } catch {
    return null
  }
}

export function clearInviteToken(): void {
  try {
    window.localStorage.removeItem(REF_KEY)
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
    const ref = url.searchParams.get(REF_PARAM)
    if (ref !== null) {
      if (UUID_PATTERN.test(ref)) window.localStorage.setItem(REF_KEY, ref)
      url.searchParams.delete(REF_PARAM)
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
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

export function buildInviteUrl(token: string, ref?: string | null): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}?${QUERY_PARAM}=${encodeURIComponent(token)}`
  return ref && UUID_PATTERN.test(ref) ? `${base}&${REF_PARAM}=${encodeURIComponent(ref)}` : base
}
