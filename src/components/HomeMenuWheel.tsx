import { useState } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import type { ReactNode } from 'react'
import type { NavKey } from './PrimaryNav'
import type { CommunityCardKey } from '../types/communityCards'
import { CarIcon } from './CarIcon'
import type { CarroSettings } from '../lib/carro'

// Menu vertical contínuo: Dicas de leitura, Respiração, Playlist, Wellness, Séries e Filmes e
// Dicas de Viagem. Só frases: um ícone único à esquerda e a frase em letras altas e robustas, dentro
// de uma borda fina cor de ouro chocolate (sem pintura). A lista sobe sem parar, como uma roda,
// entrando e saindo com um esmaecer suave, e para enquanto há um dedo (ou o mouse) em cima.
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

const FilmSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <rect x="3" y="5" width="18" height="14" rx="2.500" />
    <path d="M10 9.500l5 2.500-5 2.500z" />
  </svg>
)
const PinSvg = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    <path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21Z" />
    <circle cx="12" cy="9.500" r="2.500" />
  </svg>
)

const ALL_ITEMS: Item[] = [
  { key: 'leitura', imageKey: 'menu_leitura', title: 'Dicas de leitura', tint: 'linear-gradient(135deg,#f3dccf,#e8c3b3)', icon: BookSvg },
  { key: 'respiracao', imageKey: 'menu_respiracao', title: 'Respiração', tint: 'linear-gradient(135deg,#d8e6dc,#bcd3c4)', icon: BreathSvg },
  { key: 'playlist', imageKey: 'menu_playlist', title: 'Playlist', tint: 'linear-gradient(135deg,#dcd6ea,#c6bddb)', icon: MusicSvg },
  { key: 'wellness', imageKey: 'menu_wellness', title: 'Wellness', tint: 'linear-gradient(135deg,#d3e4d6,#b4d0bb)', icon: LeafSvg },
  { key: 'series', imageKey: 'menu_series', title: 'Séries e Filmes', tint: 'linear-gradient(135deg,#e3d6e8,#cdbad6)', icon: FilmSvg },
  { key: 'viagens', imageKey: 'menu_viagens', title: 'Dicas de Viagem', tint: 'linear-gradient(135deg,#d6e4ea,#b9d0da)', icon: PinSvg },
]

/** Ícone único do card (a cor vem da borda, via currentColor). */
function WheelThumb({ item }: { item: Item }) {
  return (
    <span className="wheel-thumb" aria-hidden="true">
      {item.icon}
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

export function HomeMenuWheel({ onNavigate, showSubscriptions = true, carro = null }: Props) {
  void showSubscriptions
  // Dedo em cima: a roda para (e volta ao soltar ou se o gesto virar rolagem da página).
  const [paused, setPaused] = useState(false)
  const items = [...ALL_ITEMS]
  if (carro?.ativo) {
    items.splice(Math.min(Math.max(carro.ordem, 0), items.length), 0, {
      key: 'carro',
      imageKey: 'menu_carro' as CommunityCardKey,
      title: carro.titulo,
      tint: 'linear-gradient(135deg,#ecd9c6,#d6b286)',
      icon: <CarIcon name={carro.icone} size={26} />,
    })
  }
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
          <WheelThumb item={item} />
          <span className="wheel-title">{item.title}</span>
        </button>
      </li>
    ))

  return (
    <m.section className="home-wheel" aria-label="Menu de conteúdos" {...inViewOnce} variants={riseVariants}>
      <div
        className={`wheel-viewport${paused ? ' wheel-viewport--paused' : ''}`}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <ul className="wheel-track" style={{ animationDuration: `${duration}s` }}>
          {render(false)}
          {render(true)}
        </ul>
      </div>
    </m.section>
  )
}
