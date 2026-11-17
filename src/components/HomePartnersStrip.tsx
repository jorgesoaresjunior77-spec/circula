import type React from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { marqueeRepeats, partnerLogoBoost, safePartnerLink } from '../lib/partners'
import type { Partner } from '../lib/partners'
import { recordView } from '../lib/itemViews'

// Parceiros: os logos ficam lado a lado, nas cores originais, e a faixa anda
// devagar para a esquerda, sem parar (como os cartões do Menu). Tocar no logo
// abre o site do parceiro (se a profissional cadastrou o link). A lista é
// desenhada duas vezes para a emenda não aparecer; a segunda cópia é só
// visual (escondida de leitores de tela e do teclado). Com "reduzir
// movimento", a faixa fica parada e rola com o dedo. Só aparece se houver
// parceiro publicado.

/** Segundos que cada logo leva para atravessar o próprio espaço (devagar). */
export const PARTNER_SECONDS_PER_LOGO = 7

function Logo({ partner, copy }: { partner: Partner; copy: boolean }) {
  const { url } = useSignedImageUrl(partner.logo_path)
  const link = safePartnerLink(partner.link_url)
  const cls = partnerLogoBoost(partner.name) ? 'partner-logo partner-logo--boost' : 'partner-logo'
  if (!url) return <span className="partner-logo partner-logo--loading" aria-hidden="true" />
  const img = <img src={url} alt={link || copy ? '' : partner.name} draggable={false} />
  return link ? (
    <a
      className={cls}
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${partner.name} (abre o site do parceiro)`}
      tabIndex={copy ? -1 : undefined}
      onClick={() => recordView(partner.community_id, 'partner_click', partner.id)}
    >
      {img}
    </a>
  ) : (
    <span className={cls}>{img}</span>
  )
}

// Girassóis flutuando dentro do card: flores desenhadas em SVG que sobem e
// descem devagar, giram de leve e variam de tamanho e de nitidez (as menores
// ficam um pouco desfocadas, para dar profundidade). Só decoração: escondida
// de leitores de tela, sem receber toque, paradas com "reduzir movimento".
function Sunflower() {
  const petals = Array.from({ length: 16 }, (_, i) => (
    <ellipse
      key={i}
      cx="50"
      cy="19"
      rx="7.2"
      ry="17"
      transform={`rotate(${(i * 360) / 16} 50 50)`}
    />
  ))
  const back = Array.from({ length: 16 }, (_, i) => (
    <ellipse
      key={i}
      cx="50"
      cy="21"
      rx="7"
      ry="16"
      transform={`rotate(${(i * 360) / 16 + 11.25} 50 50)`}
    />
  ))
  const seeds = Array.from({ length: 22 }, (_, i) => {
    const r = 3.5 + 11 * Math.sqrt((i + 0.5) / 22)
    const ang = i * 2.39996 // ângulo dourado, como as sementes de verdade
    return <circle key={i} cx={50 + r * Math.cos(ang)} cy={50 + r * Math.sin(ang)} r="1.5" />
  })
  return (
    <svg viewBox="0 0 100 100" className="sunflower-svg" focusable="false">
      <defs>
        <radialGradient id="sf-petal" cx="50%" cy="20%" r="80%">
          <stop offset="0" stopColor="#cdbfae" />
          <stop offset="1" stopColor="#b5a48f" />
        </radialGradient>
        <radialGradient id="sf-back" cx="50%" cy="20%" r="80%">
          <stop offset="0" stopColor="#c4b5a2" />
          <stop offset="1" stopColor="#a8957e" />
        </radialGradient>
        <radialGradient id="sf-core" cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#8b7a69" />
          <stop offset="1" stopColor="#6a5b4e" />
        </radialGradient>
      </defs>
      <g fill="url(#sf-back)">{back}</g>
      <g fill="url(#sf-petal)">{petals}</g>
      <circle cx="50" cy="50" r="16" fill="url(#sf-core)" />
      <g fill="#b9a893" opacity="0.7">{seeds}</g>
    </svg>
  )
}

const SUNFLOWERS: { x: number; y: number; size: number; dur: number; delay: number; blur: number; spin: number }[] = [
  { x: 4, y: 10, size: 84, dur: 9, delay: 0, blur: 0, spin: 14 },
  { x: 84, y: 6, size: 68, dur: 11, delay: -3, blur: 0, spin: -12 },
  { x: 40, y: 74, size: 60, dur: 10, delay: -5, blur: 1, spin: 10 },
  { x: 92, y: 62, size: 46, dur: 8, delay: -2, blur: 2, spin: -16 },
  { x: 18, y: 66, size: 44, dur: 12, delay: -7, blur: 2, spin: 12 },
  { x: 62, y: 4, size: 38, dur: 13, delay: -9, blur: 3, spin: -10 },
]

function FloatingSunflowers() {
  return (
    <div className="sunflowers" aria-hidden="true">
      {SUNFLOWERS.map((f, i) => (
        <span
          key={i}
          className="sunflower"
          style={
            {
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: f.size,
              height: f.size,
              filter: f.blur ? `blur(${f.blur}px)` : undefined,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
              '--spin': `${f.spin}deg`,
            } as React.CSSProperties
          }
        >
          <Sunflower />
        </span>
      ))}
    </div>
  )
}

export function HomePartnersStrip({ communityId }: { communityId: string }) {
  const { items } = useManagedContent<Partner>('community_partners', communityId, 'position')
  const partners = items.filter((p) => p.status === 'published')
  const count = partners.length
  if (count === 0) return null

  // Com poucos parceiros, repete a lista dentro de cada metade para a faixa
  // sempre cobrir a largura da tela.
  const repeats = marqueeRepeats(count)
  const perHalf = count * repeats
  const half = (copy: boolean) => (
    <ul className="partner-seq" aria-hidden={copy || undefined}>
      {Array.from({ length: repeats }, (_, r) =>
        partners.map((p) => (
          <li key={`${p.id}-${r}`} className="partner-item">
            <Logo partner={p} copy={copy || r > 0} />
          </li>
        )),
      )}
    </ul>
  )

  return (
    <m.section className="home-partners" aria-label="Parceiros" {...inViewOnce} variants={riseVariants}>
      <FloatingSunflowers />
      <h3 className="home-partners-title">Parceiros</h3>
      <div className="partner-viewport">
        <div className="partner-track" style={{ animationDuration: `${perHalf * PARTNER_SECONDS_PER_LOGO}s` }}>
          {half(false)}
          {half(true)}
        </div>
      </div>
    </m.section>
  )
}
