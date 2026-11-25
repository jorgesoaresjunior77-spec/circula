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

// Nome do círculo escrito em arco, embaixo e um pouco para a direita, acompanhando a borda da foto
// com um pequeno espaço. A unidade do desenho é 1% da largura do círculo (a foto tem raio 50).
const LABEL_SIZE = { a: 10.5, b: 14.5, c: 15.5 } as const

function arcPoint(r: number, deg: number): string {
  const rad = (deg * Math.PI) / 180
  return `${(50 + r * Math.cos(rad)).toFixed(2)} ${(50 + r * Math.sin(rad)).toFixed(2)}`
}

function TrioLabel({ id, text, size }: { id: string; text: string; size: number }) {
  const r = 50 + 7 + size * 0.72
  // de baixo-esquerda, passando pelo fundo, até baixo-direita (letras em pé)
  const d = `M ${arcPoint(r, 175)} A ${r} ${r} 0 0 0 ${arcPoint(r, 15)}`
  return (
    <svg className="home-trio-label" viewBox="-25 -25 150 150" aria-hidden="true" focusable="false">
      <path id={id} d={d} fill="none" />
      <text fontSize={size}>
        <textPath href={`#${id}`} startOffset="62%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  )
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
      <TrioLabel id={`trio-label-${position}`} text={eyebrow} size={LABEL_SIZE[position]} />
      <span className="home-trio-text">
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
      {cards.map(({ key, ...card }) => (
        <TrioCircle key={key} {...card} />
      ))}
    </section>
  )
}
