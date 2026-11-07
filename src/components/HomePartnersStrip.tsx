import { useEffect, useRef } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { focusAt, safePartnerLink } from '../lib/partners'
import type { Partner } from '../lib/partners'

// Faixa de logos dos parceiros, em movimento contínuo. Os logos ficam
// "bege" (apagados) nas pontas e ganham cor no centro. Com "reduzir
// movimento" ligado, a faixa para: vira uma fileira rolável, com cores.
// Só aparece se houver parceiro publicado.

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function Logo({ partner, hidden }: { partner: Partner; hidden?: boolean }) {
  const { url } = useSignedImageUrl(partner.logo_path)
  const link = safePartnerLink(partner.link_url)
  if (!url) return null
  const img = <img src={url} alt={hidden ? '' : partner.name} loading="lazy" draggable={false} />
  return (
    <li className="partners-item" aria-hidden={hidden || undefined}>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined}>
          {img}
        </a>
      ) : (
        img
      )}
    </li>
  )
}

export function HomePartnersStrip({ communityId }: { communityId: string }) {
  const { items } = useManagedContent<Partner>('community_partners', communityId, 'position')
  const partners = items.filter((p) => p.status === 'published')
  const viewportRef = useRef<HTMLDivElement>(null)
  const reduced = typeof window !== 'undefined' && prefersReducedMotion()
  const count = partners.length

  // Cor por distância do centro: atualiza --focus de cada logo a cada quadro.
  useEffect(() => {
    if (reduced || count === 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    let raf = 0
    const tick = () => {
      const box = viewport.getBoundingClientRect()
      viewport.querySelectorAll<HTMLElement>('.partners-item').forEach((el) => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--focus', focusAt(r.left + r.width / 2, box.left, box.width).toFixed(3))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced, count])

  if (count === 0) return null

  return (
    <section className="home-partners" aria-label="Parceiros">
      <h3 className="home-partners-title">Parceiros</h3>
      <div ref={viewportRef} className={`partners-viewport${reduced ? ' partners-viewport--static' : ''}`}>
        <ul
          className="partners-track"
          style={reduced ? undefined : { animationDuration: `${Math.max(18, count * 6)}s` }}
        >
          {partners.map((p) => (
            <Logo key={p.id} partner={p} />
          ))}
          {!reduced && partners.map((p) => <Logo key={`${p.id}-copy`} partner={p} hidden />)}
        </ul>
      </div>
    </section>
  )
}
