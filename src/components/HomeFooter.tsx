// Rodapé com as informações básicas de qualquer app ou site: marca, ano, termos,
// privacidade, contato e a empresa que desenvolveu o Círcula.

const YEAR = new Date().getFullYear()

export function HomeFooter() {
  const base = import.meta.env.BASE_URL
  return (
    <footer className="home-footer" aria-label="Informações do aplicativo">
      <p className="home-footer-brand">Círcula</p>
      <nav className="home-footer-links" aria-label="Documentos">
        <a href={`${base}termos.html`} target="_blank" rel="noopener noreferrer">
          Termos de Uso
        </a>
        <span aria-hidden="true">·</span>
        <a href={`${base}privacidade.html`} target="_blank" rel="noopener noreferrer">
          Política de Privacidade
        </a>
      </nav>
      <p className="home-footer-line">
        Dúvidas? Fale com a sua nutricionista pelo Help Nutri ou pela Central de Ajuda.
      </p>
      <p className="home-footer-line">© {YEAR} Círcula. Todos os direitos reservados.</p>
      <p className="home-footer-line home-footer-maker">
        Desenvolvido por <strong>+ Creative</strong>
      </p>
    </footer>
  )
}
