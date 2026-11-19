import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import type { ReactNode } from 'react'
import type { NavKey } from './PrimaryNav'
import type { CommunityCardKey } from '../types/communityCards'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'

// Menu vertical contínuo: Dicas de leitura, Respiração, Assinaturas,
// Playlist, Wellness, Lista de Compras, Exercícios e Dicas de Séries / Filmes. Cards finos, todos do mesmo tamanho, com a imagem encostada à
// esquerda e o título ao lado, em vidro transparente. A lista sobe sem parar,
// como uma roda: o card que sai por cima volta por baixo, sem pausa nem salto.
// Com "reduzir movimento", vira uma lista parada.

interface Item {
  key: NavKey
  /** Chave da foto em community_card_images (editada no painel Imagens). */
  imageKey: CommunityCardKey
  title: string
  tint: string
  icon: ReactNode
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const BookSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v16H6.500A2.500 2.500 0 0 0 4 21.500Z" />
    <path d="M4 18.500A2.500 2.500 0 0 1 6.500 16H20" />
  </svg>
)
const BreathSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="6.500" opacity="0.7" />
    <circle cx="12" cy="12" r="10" opacity="0.4" />
  </svg>
)
const MusicSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6.500" cy="18" r="2.500" />
    <circle cx="17.500" cy="16" r="2.500" />
  </svg>
)

const LeafSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
)

const CartSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M3 4h2.400l2.200 11h10.400l2-8H6.200" />
    <circle cx="9.500" cy="19.500" r="1.400" />
    <circle cx="17" cy="19.500" r="1.400" />
  </svg>
)

const DumbbellSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
  </svg>
)
const ScreenSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="m10.500 8.500 4 2.500-4 2.500Z" />
    <path d="M8 20h8" />
  </svg>
)

const ALL_ITEMS: Item[] = [
  { key: 'leitura', imageKey: 'menu_leitura', title: 'Dicas de leitura', tint: 'linear-gradient(135deg,#f3dccf,#e8c3b3)', icon: BookSvg },
  { key: 'respiracao', imageKey: 'menu_respiracao', title: 'Respiração', tint: 'linear-gradient(135deg,#d8e6dc,#bcd3c4)', icon: BreathSvg },
  { key: 'playlist', imageKey: 'menu_playlist', title: 'Playlist', tint: 'linear-gradient(135deg,#dcd6ea,#c6bddb)', icon: MusicSvg },
  { key: 'wellness', imageKey: 'menu_wellness', title: 'Wellness', tint: 'linear-gradient(135deg,#d3e4d6,#b4d0bb)', icon: LeafSvg },
  { key: 'lista', imageKey: 'menu_lista', title: 'Lista de Compras', tint: 'linear-gradient(135deg,#f1dcc6,#e6c3a0)', icon: CartSvg },
  { key: 'exercicios', imageKey: 'banner_exercicios', title: 'Se exercite em casa', tint: 'linear-gradient(135deg,#f6dfd2,#ebc2ae)', icon: DumbbellSvg },
  { key: 'series', imageKey: 'banner_series', title: 'Dicas de Séries / Filmes', tint: 'linear-gradient(135deg,#e0dcee,#c9c2de)', icon: ScreenSvg },
]

/** Miniatura do card: a foto da profissional ocupa ~60% da largura (com fade
 *  para o vidro); sem foto, o degradê com ícone de sempre. */
function WheelThumb({ item, path }: { item: Item; path: string | null }) {
  const { url } = useSignedImageUrl(path)
  if (!url) {
    return (
      <span className="wheel-thumb" style={{ background: item.tint }} aria-hidden="true">
        {item.icon}
      </span>
    )
  }
  return (
    <span className="wheel-thumb wheel-thumb--photo" aria-hidden="true">
      <img src={url} alt="" loading="lazy" decoding="async" draggable={false} />
    </span>
  )
}

interface Props {
  onNavigate: (key: NavKey) => void
  /** Caminhos das fotos dos cards (community_card_images), por chave. */
  imagePaths?: Partial<Record<CommunityCardKey, string>>
  /** A profissional não vê Assinaturas (a página de Planos é da membro). */
  showSubscriptions?: boolean
}

export function HomeMenuWheel({ onNavigate, imagePaths, showSubscriptions = true }: Props) {
  void showSubscriptions
  const items = ALL_ITEMS
  // Segundos por volta: cerca de 3,4 s por card — suave e constante (um pouco mais ágil).
  const duration = items.length * 3.4

  const render = (copy: boolean) =>
    items.map((item) => (
      <li key={`${item.key}-${copy ? 'b' : 'a'}`} className="wheel-item" aria-hidden={copy || undefined}>
        <button
          type="button"
          className="wheel-card"
          onClick={() => onNavigate(item.key)}
          tabIndex={copy ? -1 : undefined}
        >
          <WheelThumb item={item} path={imagePaths?.[item.imageKey] ?? null} />
          <span className="wheel-title">{item.title}</span>
        </button>
      </li>
    ))

  return (
    <m.section className="home-wheel" aria-label="Menu de conteúdos" {...inViewOnce} variants={riseVariants}>
      <div className="wheel-viewport">
        <ul className="wheel-track" style={{ animationDuration: `${duration}s` }}>
          {render(false)}
          {render(true)}
        </ul>
      </div>
    </m.section>
  )
}
