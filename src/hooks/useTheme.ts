import { useCallback, useEffect, useState } from 'react'

// Tema do app: claro (padrão) ou bege rosé. A participante escolhe a cor que quer pelo botão do Início.
// A escolha fica guardada neste aparelho e vale já na primeira pintura (initTheme roda no main.tsx).

export type Theme = 'light' | 'rose'
const KEY = 'circula:tema'

function readStored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'rose' ? 'rose' : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // a barra do navegador acompanha o tema
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'rose' ? '#ecd3c8' : '#f7f2ea')
}

export function initTheme() {
  apply(readStored())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'rose' ? 'rose' : readStored()))

  useEffect(() => {
    apply(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'rose' ? 'light' : 'rose'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* sem storage: vale só nesta sessão */
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
