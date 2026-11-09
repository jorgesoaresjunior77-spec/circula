// Entrada da Central de Ajuda, no fim da página inicial.

export function HomeHelpCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="home-help-card" onClick={onOpen}>
      <span className="home-help-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700" />
          <path d="M12 17h.01" />
        </svg>
      </span>
      <span className="home-help-text">
        <span className="home-help-title">Precisa de ajuda?</span>
        <span className="home-help-sub">
          Encontre respostas e descubra como aproveitar tudo o que o Círcula oferece.
        </span>
      </span>
    </button>
  )
}
