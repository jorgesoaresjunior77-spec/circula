import type { NavKey } from './PrimaryNav'
import { ChevronRightIcon } from './icons'

// Card de acesso às assinaturas e aos conteúdos, no fim da sequência de
// conteúdos da Home. Mesma linguagem do card de Receitas (imagem à
// esquerda, texto à direita, bordas arredondadas), mais fino e compacto.
// Não define regra comercial nenhuma: só leva à página de Planos.

interface HomeSubscriptionCardProps {
  /** Capa já assinada (a mesma da Loja), quando a profissional cadastrou. */
  cover?: string | null
  onNavigate: (key: NavKey) => void
}

export function HomeSubscriptionCard({ cover = null, onNavigate }: HomeSubscriptionCardProps) {
  return (
    <button type="button" className="home-subscription-card" onClick={() => onNavigate('planos')}>
      <span className="home-subscription-media" aria-hidden="true">
        {cover ? (
          <img loading="lazy" decoding="async" src={cover} alt="" />
        ) : (
          <span className="home-subscription-media-fallback" />
        )}
      </span>
      <span className="home-subscription-text">
        <span className="home-subscription-title">Assinaturas e conteúdos</span>
        <span className="home-subscription-sub">Planos, conteúdos e pacotes</span>
      </span>
      <ChevronRightIcon size={18} className="home-subscription-chevron" />
    </button>
  )
}
