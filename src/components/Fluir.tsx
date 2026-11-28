import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { CoverImageInput } from './CoverImageInput'
import fluirLogo from '../assets/fluir-logo.webp'
import { HomeGroupTitle } from './HomeGroupTitle'

// Fluir & Florescer: os pacotes de emagrecimento da nutricionista. Não são vendidos no app:
// três cards que giram no próprio eixo (frente e verso cadastrados no Painel) e, ao tocar, a página
// do pacote com título, descrição, valor, formas de pagamento, dúvidas e o botão "Saiba mais" (WhatsApp).

export interface FluirPackage {
  id?: string
  position: 1 | 2 | 3
  front_path: string | null
  back_path: string | null
  title: string
  description: string
  price_text: string
  payment_text: string
  faq_text: string
}

/** WhatsApp da nutricionista (pedido de 2026-11-27). */
export const NUTRI_WHATSAPP = '5551980327288'
export const FLUIR_FREE_NOTICE = 'Se você contratar um plano de emagrecimento, você terá o Círcula app 100% grátis.'

const EMPTY = (position: 1 | 2 | 3): FluirPackage => ({
  position,
  front_path: null,
  back_path: null,
  title: '',
  description: '',
  price_text: '',
  payment_text: '',
  faq_text: '',
})

export function useFluirPackages(communityId: string | null) {
  const [items, setItems] = useState<FluirPackage[]>([EMPTY(1), EMPTY(2), EMPTY(3)])
  const [loading, setLoading] = useState(!!communityId)
  const refresh = useCallback(async () => {
    if (!communityId) return
    setLoading(true)
    const { data } = await supabase
      .from('fluir_packages')
      .select('id, position, front_path, back_path, title, description, price_text, payment_text, faq_text')
      .eq('community_id', communityId)
    const rows = (data ?? []) as FluirPackage[]
    setItems(([1, 2, 3] as const).map((pos) => rows.find((r) => r.position === pos) ?? EMPTY(pos)))
    setLoading(false)
  }, [communityId])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const save = useCallback(
    async (pkg: FluirPackage) => {
      if (!communityId) return 'Sem comunidade.'
      const { error } = await supabase.from('fluir_packages').upsert(
        {
          community_id: communityId,
          position: pkg.position,
          front_path: pkg.front_path || null,
          back_path: pkg.back_path || null,
          title: pkg.title.trim(),
          description: pkg.description.trim(),
          price_text: pkg.price_text.trim(),
          payment_text: pkg.payment_text.trim(),
          faq_text: pkg.faq_text.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'community_id,position' },
      )
      if (error) return error.message
      await refresh()
      return null
    },
    [communityId, refresh],
  )
  return { items, loading, save, refresh }
}

// Qual pacote abrir na página (o card tocado no Início).
let requested: 1 | 2 | 3 = 1
export function requestFluirPackage(position: 1 | 2 | 3) {
  requested = position
}

function FlipCard({ pkg, delay, onOpen }: { pkg: FluirPackage; delay: number; onOpen: () => void }) {
  const { url: front } = useSignedImageUrl(pkg.front_path)
  const { url: back } = useSignedImageUrl(pkg.back_path)
  const name = pkg.title || `Pacote ${pkg.position}`
  return (
    <button type="button" className="fluir-card" onClick={onOpen} aria-label={`${name}: saiba mais`}>
      <span className="fluir-card-spin" style={{ animationDelay: `${delay}s` }}>
        <span className="fluir-face fluir-face--front">
          {front ? <img src={front} alt="" loading="lazy" decoding="async" /> : <span className="fluir-face-empty">{name}</span>}
        </span>
        <span className="fluir-face fluir-face--back">
          {back ? <img src={back} alt="" loading="lazy" decoding="async" /> : <span className="fluir-face-empty">Saiba mais</span>}
        </span>
      </span>
    </button>
  )
}

export function HomeFluirCards({ communityId, onOpen }: { communityId: string; onOpen: (position: 1 | 2 | 3) => void }) {
  const { items } = useFluirPackages(communityId)
  return (
    <m.section className="home-fluir" aria-label="Fluir & Florescer" {...inViewOnce} variants={riseVariants}>
      <HomeGroupTitle>Fluir &amp; Florescer</HomeGroupTitle>
      <div className="home-fluir-row">
        {items.map((pkg, i) => (
          <FlipCard key={pkg.position} pkg={pkg} delay={i * 1.3} onOpen={() => onOpen(pkg.position)} />
        ))}
      </div>
      <p className="home-fluir-note">{FLUIR_FREE_NOTICE}</p>
    </m.section>
  )
}

function whatsappLink(title: string) {
  const text = `Olá, Marluce! Vim pelo Círcula e quero saber mais sobre o pacote ${title || 'Fluir & Florescer'}.`
  return `https://wa.me/${NUTRI_WHATSAPP}?text=${encodeURIComponent(text)}`
}

export function FluirPage({ communityId }: { communityId: string | null }) {
  const { items, loading } = useFluirPackages(communityId)
  const [pos, setPos] = useState<1 | 2 | 3>(() => requested)
  const pkg = items.find((p) => p.position === pos) ?? items[0]
  const { url: front } = useSignedImageUrl(pkg.front_path)
  return (
    <section className="fluir-page">
      <img className="fluir-page-logo" src={fluirLogo} alt="Fluir & Florescer" decoding="async" />
      <div className="fluir-tabs" role="tablist">
        {items.map((p) => (
          <button key={p.position} type="button" role="tab" aria-selected={p.position === pos} className={p.position === pos ? 'is-active' : ''} onClick={() => setPos(p.position)}>
            {p.title || `Pacote ${p.position}`}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="home-muted">Carregando…</p>
      ) : (
        <article className="fluir-pack">
          {front && <img className="fluir-pack-img" src={front} alt="" decoding="async" />}
          <h2 className="fluir-pack-title">{pkg.title || `Pacote ${pkg.position}`}</h2>
          {pkg.description ? <p className="fluir-pack-text">{pkg.description}</p> : <p className="home-muted">A descrição deste pacote ainda vai ser cadastrada.</p>}
          {pkg.price_text && (
            <div className="fluir-pack-block">
              <h3>Valor</h3>
              <p className="fluir-pack-price">{pkg.price_text}</p>
            </div>
          )}
          {pkg.payment_text && (
            <div className="fluir-pack-block">
              <h3>Formas de pagamento</h3>
              <p className="fluir-pack-text">{pkg.payment_text}</p>
            </div>
          )}
          {pkg.faq_text && (
            <div className="fluir-pack-block">
              <h3>Dúvidas</h3>
              <p className="fluir-pack-text">{pkg.faq_text}</p>
            </div>
          )}
          <p className="fluir-pack-free">{FLUIR_FREE_NOTICE}</p>
          <a className="fluir-pack-cta" href={whatsappLink(pkg.title)} target="_blank" rel="noopener noreferrer">
            Saiba mais
          </a>
          <p className="fluir-pack-small">O pacote é contratado direto com a nutricionista, pelo WhatsApp. Não é vendido no app.</p>
        </article>
      )}
    </section>
  )
}

/** Painel: os 3 pacotes (frente, verso e textos). */
export function FluirPackagesEditor({ communityId, profileId }: { communityId: string; profileId: string }) {
  const { items, loading, save } = useFluirPackages(communityId)
  const [drafts, setDrafts] = useState<Record<number, FluirPackage>>({})
  const [msg, setMsg] = useState<Record<number, string>>({})
  if (loading) return <p className="home-muted">Carregando…</p>
  return (
    <div className="fluir-admin">
      {items.map((base) => {
        const d = drafts[base.position] ?? base
        const set = (patch: Partial<FluirPackage>) => setDrafts((s) => ({ ...s, [base.position]: { ...d, ...patch } }))
        return (
          <fieldset key={base.position} className="fluir-admin-card">
            <legend>Card {base.position}</legend>
            <div className="fluir-admin-imgs">
              <div>
                <p className="fluir-admin-label">Frente</p>
                <CoverImageInput value={d.front_path ?? ''} communityId={communityId} uid={profileId} label="" onChange={(p) => set({ front_path: p || null })} aspectRatio="3 / 4" recommendedSize="900 × 1200 px" />
              </div>
              <div>
                <p className="fluir-admin-label">Verso</p>
                <CoverImageInput value={d.back_path ?? ''} communityId={communityId} uid={profileId} label="" onChange={(p) => set({ back_path: p || null })} aspectRatio="3 / 4" recommendedSize="900 × 1200 px" />
              </div>
            </div>
            <label>
              Título
              <input value={d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label>
              Descrição
              <textarea value={d.description} maxLength={4000} rows={4} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <label>
              Valor
              <input value={d.price_text} maxLength={300} placeholder="Ex.: R$ 890,00 ou 3x de R$ 296,67" onChange={(e) => set({ price_text: e.target.value })} />
            </label>
            <label>
              Formas de pagamento
              <textarea value={d.payment_text} maxLength={1000} rows={2} placeholder="Ex.: Pix, cartão em até 3x" onChange={(e) => set({ payment_text: e.target.value })} />
            </label>
            <label>
              Dúvidas (perguntas e respostas)
              <textarea value={d.faq_text} maxLength={4000} rows={4} onChange={(e) => set({ faq_text: e.target.value })} />
            </label>
            <button
              type="button"
              className="water-primary"
              onClick={async () => {
                const err = await save(d)
                setMsg((s) => ({ ...s, [base.position]: err ? `Não foi possível salvar: ${err}` : 'Salvo.' }))
                if (!err)
                  setDrafts((s) => {
                    const next = { ...s }
                    delete next[base.position]
                    return next
                  })
              }}
            >
              Salvar card {base.position}
            </button>
            {msg[base.position] && <p className="home-muted">{msg[base.position]}</p>}
          </fieldset>
        )
      })}
    </div>
  )
}
