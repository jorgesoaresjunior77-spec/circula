import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { couponValueLabel, instagramUrl, normalizeInstagram, safePartnerLink } from '../lib/partners'
import type { Partner, PartnerCoupon } from '../lib/partners'
import { recordView } from '../lib/itemViews'

// Página do parceiro (janela por cima da tela, de baixo para cima no celular):
// foto grande do lugar, nome, descrição, categoria e cidade, Instagram, site,
// o estabelecimento em "Na minha cidade" e os cupons. A participante vê só o
// que é dela: benefício, código, validade, instruções, copiar e situação.

const DATE = (iso: string) => iso.split('-').reverse().join('/')

const REDEEM_ERRORS: Record<string, string> = {
  limit_reached: 'Você já usou este cupom o máximo de vezes permitido.',
  expired: 'Este cupom já venceu.',
  not_started: 'Este cupom ainda não começou a valer.',
  coupon_unavailable: 'Este cupom não está mais disponível.',
  not_member: 'Os cupons são para participantes da comunidade.',
}

export function InstagramGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

function validity(c: PartnerCoupon): string {
  if (c.valid_from && c.valid_until) return `Válido de ${DATE(c.valid_from)} a ${DATE(c.valid_until)}`
  if (c.valid_until) return `Válido até ${DATE(c.valid_until)}`
  if (c.valid_from) return `Válido a partir de ${DATE(c.valid_from)}`
  return 'Sem data para acabar'
}

const STATUS_LABEL: Record<PartnerCoupon['status'], string> = {
  disponivel: 'Disponível',
  esgotado: 'Já utilizado',
  expirado: 'Vencido',
  em_breve: 'Em breve',
}

function CouponCard({ coupon, onRedeemed }: { coupon: PartnerCoupon; onRedeemed: () => void }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const value = couponValueLabel(coupon)
  const off = !coupon.available
  const remaining = coupon.max_per_person != null ? Math.max(0, coupon.max_per_person - coupon.used) : null

  async function copy() {
    try {
      await navigator.clipboard.writeText(coupon.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setMsg({ ok: false, text: `Não deu para copiar. O código é ${coupon.code}.` })
    }
  }

  async function redeem() {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.rpc('redeem_partner_coupon', { p_coupon_id: coupon.id })
    setBusy(false)
    if (error) {
      const key = Object.keys(REDEEM_ERRORS).find((k) => (error.message ?? '').includes(k))
      setMsg({ ok: false, text: key ? REDEEM_ERRORS[key] : 'Não foi possível registrar agora. Tente de novo.' })
      onRedeemed()
      return
    }
    void copy()
    setMsg({ ok: true, text: 'Cupom registrado e código copiado. É só usar na loja do parceiro.' })
    onRedeemed()
  }

  return (
    <li className={`pp-coupon${off ? ' pp-coupon--off' : ''}`}>
      <div className="pp-coupon-top">
        <span className="pp-coupon-title">{coupon.title}</span>
        {value && <span className="pp-coupon-value">{value}</span>}
      </div>
      <p className="pp-coupon-benefit">{coupon.benefit}</p>
      <div className="pp-coupon-code-row">
        <code className={`pp-coupon-code${off ? ' pp-coupon-code--used' : ''}`} aria-label={`Código ${coupon.code}`}>
          {coupon.code}
        </code>
        <button type="button" className="pp-glass-btn" onClick={() => void copy()} disabled={off}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <p className="pp-coupon-meta">
        <span className={`pp-status pp-status--${coupon.status}`}>{STATUS_LABEL[coupon.status]}</span>
        <span>{validity(coupon)}</span>
        {remaining != null && coupon.status === 'disponivel' && <span>{remaining === 1 ? 'Resta 1 uso' : `Restam ${remaining} usos`}</span>}
        {coupon.max_per_person == null && <span>Uso ilimitado</span>}
      </p>
      {coupon.instructions && <p className="pp-coupon-how">{coupon.instructions}</p>}
      {!off && (
        <button type="button" className="pp-glass-btn pp-glass-btn--solid" onClick={() => void redeem()} disabled={busy}>
          {busy ? 'Registrando…' : 'Usar este cupom'}
        </button>
      )}
      {msg && (
        <p className={msg.ok ? 'auth-success' : 'auth-error'} role="status">
          {msg.text}
        </p>
      )}
    </li>
  )
}

export function usePartnerCoupons(partnerId: string | null) {
  const [coupons, setCoupons] = useState<PartnerCoupon[]>([])
  const [loading, setLoading] = useState(!!partnerId)
  const load = useCallback(async () => {
    if (!partnerId) return
    const { data } = await supabase.rpc('list_partner_coupons', { p_partner_id: partnerId })
    setCoupons(((data ?? []) as PartnerCoupon[]).map((c) => ({ ...c, discount_value: c.discount_value == null ? null : Number(c.discount_value) })))
    setLoading(false)
  }, [partnerId])
  useEffect(() => {
    void load()
  }, [load])
  return { coupons, loading, reload: load }
}

export function PartnerPage({ partner, onClose, onOpenListing }: { partner: Partner; onClose: () => void; onOpenListing?: (listingId: string) => void }) {
  const { url: cover } = useSignedImageUrl(partner.cover_path ?? null)
  const { url: logo } = useSignedImageUrl(partner.logo_path)
  const site = safePartnerLink(partner.link_url)
  const insta = instagramUrl(partner.instagram)
  const { coupons, loading, reload } = usePartnerCoupons(partner.id)

  useEffect(() => {
    recordView(partner.community_id, 'partner_click', partner.id)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [partner.id, partner.community_id, onClose])

  return createPortal(
    <div className="pp-backdrop" role="dialog" aria-modal="true" aria-label={`Parceiro ${partner.name}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="pp-sheet">
        <button type="button" className="pp-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className={`pp-cover${cover ? '' : ' pp-cover--logo'}`}>
          {cover ? <img src={cover} alt={`Foto de ${partner.name}`} /> : logo ? <img src={logo} alt={partner.name} className="pp-cover-logo" /> : null}
        </div>
        <div className="pp-body">
          <header className="pp-head">
            {cover && logo && <img src={logo} alt="" className="pp-head-logo" />}
            <div>
              <h2 className="pp-name">{partner.name}</h2>
              {(partner.category || partner.city) && (
                <p className="pp-tags">
                  {partner.category && <span className="pp-tag">{partner.category}</span>}
                  {partner.city && <span className="pp-tag">{partner.city}</span>}
                </p>
              )}
            </div>
            {insta && (
              <a className="pp-insta" href={insta} target="_blank" rel="noopener noreferrer" aria-label={`Instagram de ${partner.name} (@${normalizeInstagram(partner.instagram)})`}>
                <InstagramGlyph size={24} />
              </a>
            )}
          </header>
          {partner.description && <p className="pp-desc">{partner.description}</p>}

          <div className="pp-actions">
            {site && (
              <a className="pp-glass-btn pp-glass-btn--solid" href={site} target="_blank" rel="noopener noreferrer">
                Visitar parceiro
              </a>
            )}
            {partner.city_listing_id && onOpenListing && (
              <button type="button" className="pp-glass-btn" onClick={() => onOpenListing(partner.city_listing_id as string)}>
                Ver estabelecimento na Minha cidade
              </button>
            )}
          </div>

          <section className="pp-coupons" aria-label="Cupons de desconto">
            <h3>Cupons de desconto</h3>
            {loading && <p className="home-muted">Carregando cupons…</p>}
            {!loading && coupons.length === 0 && <p className="home-muted">Este parceiro ainda não tem cupom ativo.</p>}
            <ul>
              {coupons.map((c) => (
                <CouponCard key={c.id} coupon={c} onRedeemed={() => void reload()} />
              ))}
            </ul>
          </section>
        </div>
      </article>
    </div>,
    document.body,
  )
}
