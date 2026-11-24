import { useCallback, useEffect, useState } from 'react'

// Tema do app: claro (padrão) ou escuro (chocolate, preto e dourado).
// A escolha fica guardada neste aparelho e vale já na primeira pintura (initTheme roda no main.tsx).

export type Theme = 'light' | 'dark'
const KEY = 'circula:tema'

function readStored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // a barra do navegador acompanha o tema
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a100c' : '#faf7f1')
}

export function initTheme() {
  apply(readStored())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : readStored()))

  useEffect(() => {
    apply(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
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
