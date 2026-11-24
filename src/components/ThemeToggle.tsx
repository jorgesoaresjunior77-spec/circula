import { useTheme } from '../hooks/useTheme'

// Botão de tema (claro/escuro): trilho afundado e botão em relevo que desliza,
// como na referência "BUTTON.D". Chave de verdade (role="switch") para leitor de tela.

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Tema escuro ligado. Tocar para o tema claro' : 'Tema claro ligado. Tocar para o tema escuro'}
      className={`theme-toggle${dark ? ' theme-toggle--dark' : ''}`}
      onClick={toggle}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-knob">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {dark ? (
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
              </>
            )}
          </svg>
        </span>
      </span>
    </button>
  )
}
