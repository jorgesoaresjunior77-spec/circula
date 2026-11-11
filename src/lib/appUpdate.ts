// Atualização automática do app.
//
// O celular (e o app instalado na tela inicial) costuma segurar uma cópia
// antiga da página. Para ninguém depender de "fechar e abrir" ou reinstalar:
// cada publicação grava um identificador em version.json; ao abrir o app e ao
// voltar para ele, comparamos com o identificador embutido nesta cópia. Se
// houver um mais novo, a página recarrega já pedindo a versão nova.
//
// Cuidados:
// - version.json é buscado sem cache; a recarga leva "?v=<id>" no endereço,
//   o que fura o cache de 10 minutos do GitHub Pages para o index.html.
// - Uma tentativa por versão (sessionStorage): se a recarga ainda trouxer a
//   cópia antiga, não fica recarregando em laço.
// - Não recarrega enquanto a pessoa está digitando.
// - Qualquer falha (sem internet, arquivo ausente) é ignorada em silêncio.

declare const __BUILD_ID__: string | undefined

const TRIED_KEY = 'circula:update-tried'
/** Intervalo mínimo entre duas consultas ao voltar para o app. */
export const UPDATE_CHECK_MIN_MS = 5 * 60 * 1000

export function currentBuildId(): string | null {
  return typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : null
}

/** Decide se vale recarregar: há versão diferente e ainda não tentamos esta. */
export function shouldReload(current: string | null, remote: unknown, alreadyTried: string | null): boolean {
  if (!current) return false
  if (typeof remote !== 'string' || !remote) return false
  if (remote === current) return false
  return remote !== alreadyTried
}

/** Endereço atual com "?v=<id>" (preserva os outros parâmetros, ex.: convite). */
export function reloadUrl(href: string, id: string): string {
  const url = new URL(href)
  url.searchParams.set('v', id)
  return url.toString()
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

async function fetchRemoteId(): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const body: unknown = await res.json()
  return body && typeof body === 'object' ? (body as { id?: unknown }).id : null
}

async function checkOnce(): Promise<void> {
  const current = currentBuildId()
  if (!current) return
  try {
    const remote = await fetchRemoteId()
    let tried: string | null = null
    try {
      tried = window.sessionStorage.getItem(TRIED_KEY)
    } catch {
      /* armazenamento bloqueado: segue sem a trava (a comparação abaixo ainda evita recarga à toa) */
    }
    if (!shouldReload(current, remote, tried)) return
    if (isTyping()) return
    try {
      window.sessionStorage.setItem(TRIED_KEY, remote as string)
    } catch {
      // Sem como lembrar a tentativa, não recarrega: evita laço de recargas.
      return
    }
    window.location.replace(reloadUrl(window.location.href, remote as string))
  } catch {
    /* sem internet ou resposta inválida: tenta de novo na próxima abertura */
  }
}

/** Liga a verificação: uma vez ao abrir e ao voltar para o app (no máximo a cada 5 min). */
export function startUpdateWatcher(): void {
  if (!currentBuildId()) return
  let last = Date.now()
  void checkOnce()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - last < UPDATE_CHECK_MIN_MS) return
    last = Date.now()
    void checkOnce()
  })
}
