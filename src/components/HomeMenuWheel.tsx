import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import type { ReactNode } from 'react'
import type { NavKey } from './PrimaryNav'
import type { CommunityCardKey } from '../types/communityCards'
import { CarIcon } from './CarIcon'
import type { CarroSettings } from '../lib/carro'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'

// Cards do menu: um por conteúdo (Dicas de leitura, Respiração, Playlist, Wellness, Séries e Filmes, Viagens e
// Carro em Dia), empilhados. Cada um leva o título dentro e a foto da profissional (do joelho para cima) num canto,
// alternando esquerda e direita; sem foto, entra o ícone.

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
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v16H6.500A2.500 2.500 0 0 0 4 21.500Z" />
    <path d="M4 18.500A2.500 2.500 0 0 1 6.500 16H20" />
  </svg>
)
const BreathSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="6.500" opacity="0.7" />
    <circle cx="12" cy="12" r="10" opacity="0.4" />
  </svg>
)
const MusicSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6.500" cy="18" r="2.500" />
    <circle cx="17.500" cy="16" r="2.500" />
  </svg>
)

const LeafSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
)

const FilmSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <rect x="3" y="5" width="18" height="14" rx="2.500" />
    <path d="M10 9.500l5 2.500-5 2.500z" />
  </svg>
)
const PinSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21Z" />
    <circle cx="12" cy="9.500" r="2.500" />
  </svg>
)

const SplitSvg = (
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v12" />
    <path d="M14.500 9.200c-.6-.8-1.500-1.200-2.500-1.200-1.400 0-2.500.8-2.500 2s1 1.700 2.500 2 2.500.8 2.500 2-1.100 2-2.500 2c-1 0-1.900-.4-2.500-1.200" />
  </svg>
)

const ALL_ITEMS: Item[] = [
  { key: 'leitura', imageKey: 'menu_leitura', title: 'Dicas de leitura', tint: 'linear-gradient(135deg,#f3dccf,#e8c3b3)', icon: BookSvg },
  { key: 'respiracao', imageKey: 'menu_respiracao', title: 'Respiração', tint: 'linear-gradient(135deg,#d8e6dc,#bcd3c4)', icon: BreathSvg },
  { key: 'playlist', imageKey: 'menu_playlist', title: 'Playlist', tint: 'linear-gradient(135deg,#dcd6ea,#c6bddb)', icon: MusicSvg },
  { key: 'wellness', imageKey: 'menu_wellness', title: 'Wellness', tint: 'linear-gradient(135deg,#d3e4d6,#b4d0bb)', icon: LeafSvg },
  { key: 'series', imageKey: 'menu_series', title: 'Séries e Filmes', tint: 'linear-gradient(135deg,#e3d6e8,#cdbad6)', icon: FilmSvg },
  { key: 'viagens', imageKey: 'menu_viagens', title: 'Dicas de Viagem', tint: 'linear-gradient(135deg,#d6e4ea,#b9d0da)', icon: PinSvg },
  { key: 'rachei', imageKey: 'menu_rachei', title: 'Rachei', tint: 'linear-gradient(135deg,#efe3c9,#dcc590)', icon: SplitSvg },
]

/** Foto do card (quando a profissional cadastrou); sem foto, o ícone grande aparece no lugar. */
function WheelPhoto({ item, path }: { item: Item; path?: string }) {
  const { url } = useSignedImageUrl(path ?? null)
  return (
    <span className={`wheel-photo${url ? '' : ' wheel-photo--empty'}`} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span className="wheel-photo-icon">{item.icon}</span>}
    </span>
  )
}

interface Props {
  onNavigate: (key: NavKey) => void
  /** Caminhos das fotos dos cards (community_card_images), por chave. */
  imagePaths?: Partial<Record<CommunityCardKey, string>>
  /** A profissional não vê Assinaturas (a página de Planos é da membro). */
  showSubscriptions?: boolean
  /** Card do Carro em Dia (título, ícone e posição vêm do Painel); sem isto ou desativado, não aparece. */
  carro?: CarroSettings | null
}

export function HomeMenuWheel({ onNavigate, imagePaths, showSubscriptions = true, carro = null }: Props) {
  void showSubscriptions
  const items = [...ALL_ITEMS]
  if (carro?.ativo) {
    items.splice(Math.min(Math.max(carro.ordem, 0), items.length), 0, {
      key: 'carro',
      // Chave já existente no banco, reaproveitada (sem migração): 'menu_lista' guarda a foto do Carro em Dia.
      imageKey: 'menu_lista',
      title: carro.titulo,
      tint: 'linear-gradient(135deg,#ecd9c6,#d6b286)',
      icon: <CarIcon name={carro.icone} size={34} />,
    })
  }

  // Um card por item, empilhados, com a foto num canto (do joelho para cima) alternando esquerda e direita.
  return (
    <m.section className="home-wheel home-wheel--stack" aria-label="Menu de conteúdos" {...inViewOnce} variants={riseVariants}>
      <ul className="wheel-list">
        {items.map((item, i) => (
          <li key={item.key} className={`wheel-item wheel-item--${item.key} ${i % 2 === 0 ? 'wheel-item--borda wheel-item--foto-esq' : 'wheel-item--cheio wheel-item--foto-dir'}`}>
            <button type="button" className="wheel-card" onClick={() => onNavigate(item.key)}>
              <WheelPhoto item={item} path={imagePaths?.[item.imageKey]} />
              <span className="wheel-text">
                <span className="wheel-title">{item.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </m.section>
  )
}
