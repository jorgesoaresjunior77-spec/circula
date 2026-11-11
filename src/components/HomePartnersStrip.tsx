import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { marqueeRepeats, partnerLogoBoost, safePartnerLink } from '../lib/partners'
import type { Partner } from '../lib/partners'

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
    >
      {img}
    </a>
  ) : (
    <span className={cls}>{img}</span>
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
