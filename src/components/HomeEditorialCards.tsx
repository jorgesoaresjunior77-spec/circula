import { m, inViewOnce, riseVariants, SPRING_TAP } from '../lib/motionKit'
import { formatEventDate } from '../lib/formatEventDate'
import { PRODUCT_TYPE_LABELS, formatPriceBRL } from '../types/product'
import type { Product } from '../types/product'
import type { CommunityContent } from '../types/content'
import type { NavKey } from './PrimaryNav'

// Eventos, Loja e Receitas em 3 círculos que se cruzam (dois em cima, um
// embaixo), como no Venn da referência de identidade visual. Cada círculo é
// a foto escolhida pela profissional (Painel → Imagens da comunidade): a
// mesma cascata de antes, sem nenhuma mudança no cadastro de imagens.
//
// Cada círculo mostra UM item real (o próximo evento, o produto e a receita
// mais recentes), nunca um texto inventado. Dados 100% reaproveitados.

interface NextEvent {
  id: string
  title: string
  starts_at: string
  is_online: boolean | null
}

interface CircleSpec {
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

function TrioCircle({ position, eyebrow, tag, image, title, subtitle, footer, cta, onActivate }: CircleSpec & { position: 'a' | 'b' | 'c' }) {
  return (
    <m.button
      type="button"
      className={`home-trio-circle home-trio-circle--${position}`}
      onClick={onActivate}
      aria-label={cta}
      {...inViewOnce}
      variants={riseVariants}
      whileTap={{ scale: 0.98, transition: SPRING_TAP }}
    >
      <span className="home-trio-media">
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt="" className="home-trio-photo" />
        ) : (
          <span className="home-trio-fallback" aria-hidden="true" />
        )}
      </span>
      <span className="home-trio-text">
        <span className="home-trio-eyebrow">{eyebrow}</span>
        <span className="home-trio-title">{title}</span>
        {subtitle && <span className="home-trio-subtitle">{subtitle}</span>}
        {tag && <span className="home-trio-tag">{tag}</span>}
        {footer && <span className="home-trio-sr">{footer}</span>}
      </span>
    </m.button>
  )
}

interface HomeEditorialCardsProps {
  receitasCover?: string | null
  eventosCover?: string | null
  lojaCover?: string | null
  /** Banner grande de cada um (Painel → Imagens): prioridade máxima quando cadastrado. */
  eventosCoverGrande?: string | null
  receitasCoverGrande?: string | null
  lojaCoverGrande?: string | null
  nextEvent: NextEvent | null
  /** Foto do PRÓPRIO evento (já assinada, se o path exigir). */
  nextEventCover?: string | null
  recipesCount: number
  featuredRecipe: CommunityContent | null
  featuredRecipeCover?: string | null
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
  const cards: (CircleSpec & { key: string; position: 'a' | 'b' | 'c' })[] = [
    {
      key: 'eventos',
      position: 'a',
      eyebrow: 'Eventos',
      tag: nextEvent?.is_online === null || nextEvent?.is_online === undefined ? null : nextEvent.is_online ? 'Online' : 'Presencial',
      image: eventosCoverGrande ?? nextEventCover ?? eventosCover ?? null,
      title: nextEvent ? nextEvent.title : 'Nenhum evento agendado',
      subtitle: nextEvent ? formatEventDate(nextEvent.starts_at) : 'Fique de olho — novos eventos aparecem aqui',
      footer: null,
      cta: 'Ver eventos',
      onActivate: () => onNavigate('eventos'),
    },
    {
      key: 'loja',
      position: 'b',
      eyebrow: 'Loja',
      tag: featuredProduct ? PRODUCT_TYPE_LABELS[featuredProduct.type] : null,
      image: lojaCoverGrande ?? featuredProduct?.cover_image_url ?? lojaCover ?? null,
      title: featuredProduct ? featuredProduct.title : 'Loja da comunidade',
      subtitle: featuredProduct ? formatPriceBRL(featuredProduct.price_cents) : 'Em breve, novos produtos por aqui',
      footer: pluralNote(productsCount, 'outro produto', 'outros produtos'),
      cta: 'Ver loja',
      onActivate: () => onNavigate('loja'),
    },
    {
      key: 'receitas',
      position: 'c',
      eyebrow: 'Receitas',
      tag: featuredRecipe?.category ?? null,
      image: receitasCoverGrande ?? featuredRecipeCover ?? receitasCover ?? null,
      title: featuredRecipe ? featuredRecipe.title : 'Receitas da comunidade',
      subtitle: featuredRecipe ? (featuredRecipe.summary ?? null) : 'Em breve, novas receitas por aqui',
      footer: pluralNote(recipesCount, 'outra receita', 'outras receitas'),
      cta: 'Ver receitas',
      onActivate: () => onNavigate('receitas'),
    },
  ]

  return (
    <section className="home-trio" aria-label="Receitas, eventos e loja da comunidade">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <span key={`dec-${n}`} className={`home-trio-dec home-trio-dec--${n}`} aria-hidden="true" />
      ))}
      {cards.map(({ key, ...card }) => (
        <TrioCircle key={key} {...card} />
      ))}
    </section>
  )
}
