import { useTheme } from '../hooks/useTheme'

// Botão de tema (claro / bege rosé): trilho afundado e botão em relevo que desliza,
// como na referência "BUTTON.D". Chave de verdade (role="switch") para leitor de tela.

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const rose = theme === 'rose'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rose}
      aria-label={rose ? 'Tema bege rosé ligado. Tocar para o tema claro' : 'Tema claro ligado. Tocar para o tema bege rosé'}
      className={`theme-toggle${rose ? ' theme-toggle--rose' : ''}`}
      onClick={toggle}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-knob">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {rose ? (
              <>
                {[0, 72, 144, 216, 288].map((a) => (
                  <circle key={a} cx="12" cy="6.5" r="3.2" transform={`rotate(${a} 12 12)`} />
                ))}
                <circle cx="12" cy="12" r="1.6" />
              </>
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
