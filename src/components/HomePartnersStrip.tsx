import type React from 'react'
import { useState } from 'react'
import { PartnerPage } from './PartnerPage'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { marqueeRepeats, partnerLogoBoost, partnerLogoScale, safePartnerLink } from '../lib/partners'
import type { Partner } from '../lib/partners'
import { useLogoContent } from '../hooks/useLogoContent'

// Parceiros: os logos ficam lado a lado, nas cores originais, e a faixa anda
// devagar para a esquerda, sem parar (como os cartões do Menu). Tocar no logo
// abre a página do parceiro (foto, Instagram, site, estabelecimento e cupons). A lista é
// desenhada duas vezes para a emenda não aparecer; a segunda cópia é só
// visual (escondida de leitores de tela e do teclado). Com "reduzir
// movimento", a faixa fica parada e rola com o dedo. Só aparece se houver
// parceiro publicado.

/** Segundos que cada logo leva para atravessar o próprio espaço (devagar). */
export const PARTNER_SECONDS_PER_LOGO = 7

function Logo({ partner, copy, onOpen }: { partner: Partner; copy: boolean; onOpen: (p: Partner) => void }) {
  const { url } = useSignedImageUrl(partner.logo_path)
  const link = safePartnerLink(partner.link_url)
  const content = useLogoContent(url)
  const cls = !content && partnerLogoBoost(partner.name) ? 'partner-logo partner-logo--boost' : 'partner-logo'
  if (!url) return <span className="partner-logo partner-logo--loading" aria-hidden="true" />
  // Cada logo é ajustado pelo tamanho do DESENHO (sem a margem em volta): todos ficam do mesmo tamanho visual.
  const scale = partnerLogoScale(partner.name)
  const base = content ? ({ '--ca': content.aspect, '--ch': content.ch } as React.CSSProperties) : undefined
  const style = scale !== 1 ? ({ ...base, scale: String(scale) } as React.CSSProperties) : base
  const img = <img className={content ? 'partner-img--fit' : undefined} style={style} src={url} alt={link || copy ? '' : partner.name} draggable={false} />
  // Tocar no logo abre a página do parceiro (foto, Instagram, site, cupons).
  void link
  return (
    <button
      type="button"
      className={`${cls} partner-logo-btn`}
      aria-label={`${partner.name}: ver a página do parceiro`}
      tabIndex={copy ? -1 : undefined}
      onClick={() => onOpen(partner)}
    >
      {img}
    </button>
  )
}

export function HomePartnersStrip({ communityId, onOpenListing }: { communityId: string; onOpenListing?: (listingId: string) => void }) {
  const [open, setOpen] = useState<Partner | null>(null)
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
            <Logo partner={p} copy={copy || r > 0} onOpen={setOpen} />
          </li>
        )),
      )}
    </ul>
  )

  return (
    <m.section className="home-partners" aria-label="Parceiros" {...inViewOnce} variants={riseVariants}>
      <h3 className="home-partners-title">Parceiros</h3>
      <div className="partner-viewport">
        <div className="partner-track" style={{ animationDuration: `${perHalf * PARTNER_SECONDS_PER_LOGO}s` }}>
          {half(false)}
          {half(true)}
        </div>
      </div>
      {open && (
        <PartnerPage
          partner={open}
          onClose={() => setOpen(null)}
          onOpenListing={
            onOpenListing
              ? (id) => {
                  setOpen(null)
                  onOpenListing(id)
                }
              : undefined
          }
        />
      )}
    </m.section>
  )
}
