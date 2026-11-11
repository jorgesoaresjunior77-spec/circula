import { useEffect, useState } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { partnerLogoBoost, safePartnerLink } from '../lib/partners'
import type { Partner } from '../lib/partners'

// Parceiros: os logos giram um de cada vez, no centro, nas cores originais.
// Tocar no logo abre o site do parceiro (se a profissional cadastrou o link).
// Com "reduzir movimento" ligado, o giro automático para e a pessoa troca de
// logo pelos pontinhos. Só aparece se houver parceiro publicado.

/** Tempo que cada logo fica na tela. */
export const PARTNER_ROTATE_MS = 3500

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function Logo({ partner }: { partner: Partner }) {
  const { url } = useSignedImageUrl(partner.logo_path)
  const link = safePartnerLink(partner.link_url)
  const cls = partnerLogoBoost(partner.name) ? 'partner-logo partner-logo--boost' : 'partner-logo'
  if (!url) return <span className="partner-logo partner-logo--loading" aria-hidden="true" />
  const img = <img src={url} alt={link ? '' : partner.name} draggable={false} />
  return link ? (
    <a
      className={cls}
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${partner.name} (abre o site do parceiro)`}
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
  const [index, setIndex] = useState(0)
  const reduced = typeof window !== 'undefined' && prefersReducedMotion()

  useEffect(() => {
    if (reduced || count < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), PARTNER_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [reduced, count])

  if (count === 0) return null
  const current = partners[Math.min(index, count - 1)]

  return (
    <section className="home-partners" aria-label="Parceiros">
      <h3 className="home-partners-title">Parceiros</h3>
      {/* A chave troca o logo inteiro: cada um entra com um fade suave. */}
      <div className="partner-stage" key={current.id}>
        <Logo partner={current} />
      </div>
      {count > 1 && (
        <div className="partner-dots" role="group" aria-label="Escolher parceiro">
          {partners.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`partner-dot${i === index ? ' partner-dot--active' : ''}`}
              aria-label={`Parceiro ${i + 1} de ${count}: ${p.name}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
