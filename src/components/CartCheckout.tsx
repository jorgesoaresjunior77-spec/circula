import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAddonCheckout } from '../hooks/useAddonCheckout'
import { useSubscription } from '../hooks/useSubscription'
import { CYCLE_LABEL, PREMIUM_PRICES_CENTS, PRODUCTS, formatBrl, pricesOf } from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import type { DocumentType } from '../types/billing'
import { RoboInsiste } from './RoboPlanos'

// Cesta: a membro marca quantos conteúdos quiser e assina todos juntos, numa cobrança só.
// O Premium continua sendo a opção com tudo: aqui mostramos a comparação, sem forçar nada.

const CYCLES: PlanCycle[] = ['annual', 'semiannual', 'monthly']
const ORDER = ['magazine', 'ebooks', 'receitas', 'meu_chef', 'minha_lista', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'lista_inteligente', 'exercicios', 'series_filmes', 'viagens'] as const

export function CartCheckout({
  communityId,
  ownedKeys,
  onCheckoutStarted,
  onOpenPremium,
}: {
  communityId: string | null
  /** Conteúdos que a membro já tem (não entram na cesta). */
  ownedKeys: string[]
  onCheckoutStarted?: (cycle: PlanCycle) => void
  onOpenPremium?: () => void
}) {
  const { hasBillingCustomerData, saveBillingCustomerData } = useSubscription({ subject: 'community', communityId: communityId ?? undefined })
  const { subscribeCart, busy } = useAddonCheckout(communityId)
  const [picked, setPicked] = useState<string[]>([])
  const [cycle, setCycle] = useState<PlanCycle>('annual')
  const [documentType, setDocumentType] = useState<DocumentType>('CPF')
  const [documentNumber, setDocumentNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const products = useMemo(() => ORDER.map((k) => PRODUCTS.find((p) => p.key === k)).filter((p): p is (typeof PRODUCTS)[number] => !!p), [])
  const totals = useMemo(() => {
    const out: Record<PlanCycle, number> = { monthly: 0, semiannual: 0, annual: 0 }
    for (const p of products) {
      if (!picked.includes(p.key)) continue
      const pr = pricesOf(p)
      out.monthly += pr.monthly
      out.semiannual += pr.semiannual
      out.annual += pr.annual
    }
    return out
  }, [picked, products])

  const premium = PREMIUM_PRICES_CENTS[cycle]
  const total = totals[cycle]
  const overPremium = picked.length >= 2 && total >= premium
  const canBuy = picked.length >= 2 && !overPremium

  function toggle(key: string) {
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]))
  }

  async function handleSaveDocument(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await saveBillingCustomerData(documentType, documentNumber)
    setSaving(false)
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Dados de cobrança salvos.' })
  }

  async function buy() {
    setMessage(null)
    const { error, invoiceUrl } = await subscribeCart(picked, cycle)
    if (error) return setMessage({ ok: false, text: error })
    if (invoiceUrl) window.open(invoiceUrl, '_blank')
    setMessage({ ok: true, text: 'Conclua o pagamento na página que abriu em outra aba. Os conteúdos liberam juntos, quando o pagamento é confirmado.' })
    onCheckoutStarted?.(cycle)
  }

  if (!communityId) return <p className="home-muted">Entre em uma comunidade para assinar.</p>

  return (
    <div className="cart">
      <p className="plans-text">Marque os conteúdos que você quer e assine todos juntos, com uma cobrança só. Escolha pelo menos 2.</p>

      <ul className="cart-list">
        {products.map((p) => {
          const owned = ownedKeys.includes(p.key)
          const on = picked.includes(p.key)
          return (
            <li key={p.key} className={`cart-item${on ? ' cart-item--on' : ''}${owned ? ' cart-item--owned' : ''}`}>
              <label>
                <input type="checkbox" checked={on} disabled={owned} onChange={() => toggle(p.key)} />
                <span className="cart-item-name">
                  <strong>{p.name}</strong>
                  <small>{owned ? 'Você já tem' : p.description}</small>
                </span>
                <span className="cart-item-price">{formatBrl(pricesOf(p)[cycle])}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="addon-cycles" role="radiogroup" aria-label="Ciclo de cobrança da cesta">
        {CYCLES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cycle === c} className={`schedule-type${cycle === c ? ' schedule-type--on' : ''}`} onClick={() => setCycle(c)}>
            {CYCLE_LABEL[c]}
            {c === 'annual' && <small className="addon-cycle-best"> · Melhor escolha agora</small>}
          </button>
        ))}
      </div>

      {picked.length >= 1 && <RoboInsiste cycle={cycle} prices={totals} onPick={setCycle} />}

      <div className="cart-total">
        <span>
          {picked.length} {picked.length === 1 ? 'conteúdo' : 'conteúdos'} · {CYCLE_LABEL[cycle].toLowerCase()}
        </span>
        <strong>{formatBrl(total)}</strong>
      </div>
      <p className="cart-premium-note">
        Com o <strong>Círcula Premium</strong> você leva o Círcula e todos os conteúdos por {formatBrl(premium)} ({CYCLE_LABEL[cycle].toLowerCase()}).{' '}
        {onOpenPremium && (
          <button type="button" className="water-link" onClick={onOpenPremium}>
            Ver o Premium
          </button>
        )}
      </p>
      {overPremium && <p className="auth-error">Esta cesta custa o mesmo que o Premium, ou mais. No Premium você leva tudo, então vale mais a pena.</p>}

      {hasBillingCustomerData === false && (
        <form onSubmit={(e) => void handleSaveDocument(e)} className="question-form">
          <label htmlFor="cart-doc-type">Tipo de documento</label>
          <select id="cart-doc-type" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
          <label htmlFor="cart-doc-number">{documentType}</label>
          <input id="cart-doc-number" type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} required />
          <button type="submit" disabled={saving || !documentNumber.trim()}>
            {saving ? 'Salvando...' : 'Salvar dados de cobrança'}
          </button>
        </form>
      )}

      {hasBillingCustomerData && (
        <button type="button" className="water-primary" disabled={busy || !canBuy} onClick={() => void buy()}>
          {busy ? 'Abrindo…' : picked.length < 2 ? 'Escolha pelo menos 2 conteúdos' : `Assinar tudo junto · ${formatBrl(total)}`}
        </button>
      )}

      {message && <p className={message.ok ? 'auth-success' : 'auth-error'}>{message.text}</p>}
    </div>
  )
}
