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

// Bolinhas redondas quase imperceptíveis no fundo do card, como sombras suaves que
// sobem e descem devagar (as menores ficam um pouco desfocadas, para dar
// profundidade). Só decoração: escondidas de leitores de tela, sem receber toque,
// paradas com "reduzir movimento".
const SUNFLOWERS: { x: number; y: number; size: number; dur: number; delay: number; blur: number; spin: number }[] = [
  { x: 4, y: 5, size: 84, dur: 9, delay: 0, blur: 0, spin: 14 },
  { x: 84, y: 3, size: 68, dur: 11, delay: -3, blur: 0, spin: -12 },
  { x: 62, y: 2, size: 38, dur: 13, delay: -9, blur: 3, spin: -10 },
  { x: 40, y: 38, size: 60, dur: 10, delay: -5, blur: 1, spin: 10 },
  { x: 92, y: 33, size: 46, dur: 8, delay: -2, blur: 2, spin: -16 },
  { x: 18, y: 35, size: 44, dur: 12, delay: -7, blur: 2, spin: 12 },
  // Desce pela área abaixo do card, até o fim da página.
  { x: 70, y: 54, size: 72, dur: 11, delay: -4, blur: 0, spin: 12 },
  { x: 8, y: 62, size: 78, dur: 10, delay: -6, blur: 1, spin: -14 },
  { x: 48, y: 72, size: 52, dur: 12, delay: -1, blur: 2, spin: 10 },
  { x: 88, y: 80, size: 64, dur: 9, delay: -8, blur: 1, spin: -12 },
  { x: 26, y: 86, size: 58, dur: 13, delay: -3, blur: 2, spin: 14 },
  { x: 62, y: 92, size: 70, dur: 10, delay: -5, blur: 0, spin: -10 },
]

function FloatingDots() {
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
        />
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
      <FloatingDots />
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
