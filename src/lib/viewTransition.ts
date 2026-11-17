import { flushSync } from 'react-dom'

// Transição "a capa cresce até virar a página aberta": usa a View Transitions
// API do navegador (sem biblioteca). O elemento tocado recebe o nome da
// transição só durante o instante da troca; o destino tem o mesmo nome no CSS.
// Sem suporte (ou com "reduzir movimento"), apenas faz a troca normal.

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<unknown> } }

export function morphOpen(from: HTMLElement | null | undefined, name: string, update: () => void): void {
  const doc = typeof document === 'undefined' ? null : (document as DocWithVT)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!doc || !doc.startViewTransition || !from || reduce) {
    update()
    return
  }
  from.style.setProperty('view-transition-name', name)
  try {
    const t = doc.startViewTransition(() => {
      from.style.removeProperty('view-transition-name')
      flushSync(update)
    })
    void t.finished.catch(() => undefined).finally(() => from.style.removeProperty('view-transition-name'))
  } catch {
    from.style.removeProperty('view-transition-name')
    update()
  }
}
