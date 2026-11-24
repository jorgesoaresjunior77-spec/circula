// Rodapé só com o escrito (sem caixa): termos, privacidade, ano e a empresa que desenvolveu o Círcula.

const YEAR = new Date().getFullYear()

export function HomeFooter() {
  const base = import.meta.env.BASE_URL
  return (
    <footer className="home-footer" aria-label="Informações do aplicativo">
      <nav className="home-footer-links" aria-label="Documentos">
        <a href={`${base}termos.html`} target="_blank" rel="noopener noreferrer">
          Termos de Uso
        </a>
        <span aria-hidden="true">·</span>
        <a href={`${base}privacidade.html`} target="_blank" rel="noopener noreferrer">
          Política de Privacidade
        </a>
      </nav>
      <p className="home-footer-line">© {YEAR} Círcula. Todos os direitos reservados.</p>
      <p className="home-footer-line home-footer-maker">
        Desenvolvido por <strong>+ Creative</strong>
      </p>
    </footer>
  )
}
