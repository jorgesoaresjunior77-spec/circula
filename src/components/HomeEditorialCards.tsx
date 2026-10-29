import { formatEventDate } from '../lib/formatEventDate'
import { PRODUCT_TYPE_LABELS, formatPriceBRL } from '../types/product'
import type { Product } from '../types/product'
import type { CommunityContent } from '../types/content'
import type { NavKey } from './PrimaryNav'

// Pedido do usuário — cards editoriais de Receitas/Eventos/Loja, depois
// da faixa "No Instagram" na Home. NÃO são versões maiores dos cards
// compactos dos carrosséis (sem texto sobreposto à foto): cada card tem
// duas regiões separadas — imagem de destaque no topo, informações
// textuais numa área própria embaixo, com hierarquia e espaço de
// leitura.
//
// Finalização (pedido do usuário) — "vitrines de conteúdo em destaque":
// cada card mostra UM item real (o próprio evento/receita/produto, com
// seus próprios dados), nunca mais só um rótulo genérico de categoria +
// contagem. É essa diferença de conteúdo (específico, editorial) — não
// só de tamanho — que os distingue dos atalhos compactos da faixa "Seu
// Círcula de hoje", que continuam existindo e levando aos mesmos 3
// destinos. A imagem prioriza a foto do PRÓPRIO item (evento/receita)
// quando existe, caindo para a capa genérica da categoria (configurada
// pela Profissional em Painel → Imagens da comunidade) só na ausência
// dela — nunca o contrário. Produto não tem capa "genérica de
// categoria" própria (reaproveita a de "Loja"), então a prioridade é a
// mesma: foto do produto, senão a capa de "Loja".
//
// Dados 100% reaproveitados (sem consulta nova, sem tabela nova):
// evento = o próximo (useRailSummary, já existente); receita/produto =
// o mais recente PUBLICADO de `useContent`/`useProducts` (já carregados
// em HomeToday para outros fins), escolhido por já virem ordenados
// created_at DESC — o primeiro que casa o filtro já é o mais recente.

interface NextEvent {
  id: string
  title: string
  starts_at: string
  is_online: boolean | null
}

interface EditorialCardSpec {
  eyebrow: string
  tag: string | null
  image: string | null
  title: string
  subtitle: string | null
  footer: string | null
  cta: string
  onActivate: () => void
}

function pluralNote(count: number, singular: string, plural: string): string | null {
  const rest = count - 1
  if (rest <= 0) return null
  return `+${rest} ${rest === 1 ? singular : plural}`
}

function EditorialCard({ eyebrow, tag, image, title, subtitle, footer, cta, onActivate }: EditorialCardSpec) {
  return (
    <button type="button" className="home-editorial-card" onClick={onActivate}>
      <span className="home-editorial-card-media">
        {image ? (
          <img src={image} alt="" className="home-editorial-card-photo" />
        ) : (
          <span className="home-editorial-card-media-fallback" aria-hidden="true" />
        )}
      </span>
      <span className="home-editorial-card-body">
        <span className="home-editorial-card-eyebrow">{eyebrow}</span>
        {tag && <span className="home-editorial-card-tag">{tag}</span>}
        <span className="home-editorial-card-title">{title}</span>
        {subtitle && <span className="home-editorial-card-subtitle">{subtitle}</span>}
        {footer && <span className="home-editorial-card-footer">{footer}</span>}
        <span className="home-editorial-card-cta">
          {cta} <span aria-hidden="true">→</span>
        </span>
      </span>
    </button>
  )
}

interface HomeEditorialCardsProps {
  receitasCover?: string | null
  eventosCover?: string | null
  lojaCover?: string | null
  /** Correções visuais (item 4) — banner editorial grande, independente
   *  da capa do card compacto (`eventosCover`/`receitasCover`/
   *  `lojaCover` acima) e da foto do item em destaque. Prioridade
   *  máxima quando cadastrado (Painel → Imagens da comunidade → Banners
   *  editoriais grandes); ausente, a cascata de fallback atual segue
   *  intocada. */
  eventosCoverGrande?: string | null
  receitasCoverGrande?: string | null
  lojaCoverGrande?: string | null
  nextEvent: NextEvent | null
  /** Foto do PRÓPRIO evento (já assinada, se o path exigir) — prioridade sobre `eventosCover`. */
  nextEventCover?: string | null
  /** Quantidade de receitas publicadas na comunidade — de `useContent`, já carregado em HomeToday; sem consulta nova. */
  recipesCount: number
  featuredRecipe: CommunityContent | null
  /** Foto da PRÓPRIA receita (já assinada, se o path exigir) — prioridade sobre `receitasCover`. */
  featuredRecipeCover?: string | null
  /** Quantidade de produtos publicados na comunidade (RLS já restringe Member a `status='published'`). */
  productsCount: number
  featuredProduct: Product | null
  onNavigate: (key: NavKey) => void
}

export function HomeEditorialCards({
  receitasCover,
  eventosCover,
  lojaCover,
  eventosCoverGrande,
  receitasCoverGrande,
  lojaCoverGrande,
  nextEvent,
  nextEventCover,
  recipesCount,
  featuredRecipe,
  featuredRecipeCover,
  productsCount,
  featuredProduct,
  onNavigate,
}: HomeEditorialCardsProps) {
  const cards: (EditorialCardSpec & { key: string })[] = [
    {
      key: 'eventos',
      eyebrow: 'Eventos',
      tag: nextEvent?.is_online === null || nextEvent?.is_online === undefined
        ? null
        : nextEvent.is_online
          ? 'Online'
          : 'Presencial',
      image: eventosCoverGrande ?? nextEventCover ?? eventosCover ?? null,
      title: nextEvent ? nextEvent.title : 'Nenhum evento agendado',
      subtitle: nextEvent ? formatEventDate(nextEvent.starts_at) : 'Fique de olho — novos eventos aparecem aqui',
      footer: null,
      cta: 'Ver eventos',
      onActivate: () => onNavigate('eventos'),
    },
    {
      key: 'receitas',
      eyebrow: 'Receitas',
      tag: featuredRecipe?.category ?? null,
      image: receitasCoverGrande ?? featuredRecipeCover ?? receitasCover ?? null,
      title: featuredRecipe ? featuredRecipe.title : 'Receitas da comunidade',
      subtitle: featuredRecipe
        ? (featuredRecipe.summary ?? null)
        : 'Em breve, novas receitas por aqui',
      footer: pluralNote(recipesCount, 'outra receita', 'outras receitas'),
      cta: 'Ver receitas',
      onActivate: () => onNavigate('receitas'),
    },
    {
      key: 'loja',
      eyebrow: 'Loja',
      tag: featuredProduct ? PRODUCT_TYPE_LABELS[featuredProduct.type] : null,
      image: lojaCoverGrande ?? featuredProduct?.cover_image_url ?? lojaCover ?? null,
      title: featuredProduct ? featuredProduct.title : 'Loja da comunidade',
      subtitle: featuredProduct
        ? formatPriceBRL(featuredProduct.price_cents)
        : 'Em breve, novos produtos por aqui',
      footer: pluralNote(productsCount, 'outro produto', 'outros produtos'),
      cta: 'Ver loja',
      onActivate: () => onNavigate('loja'),
    },
  ]

  return (
    <section className="home-editorial-cards" aria-label="Receitas, eventos e loja da comunidade">
      {cards.map(({ key, ...card }) => (
        <EditorialCard key={key} {...card} />
      ))}
    </section>
  )
}
