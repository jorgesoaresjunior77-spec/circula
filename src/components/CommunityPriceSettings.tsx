import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useCommunityBillingSettings } from '../hooks/useCommunityBillingSettings'
import { MEMBER_PRICE_MIN_CENTS } from '../types/billing'

// FASE 16.1-P — a Professional dona vê e altera o preço da assinatura da
// PRÓPRIA comunidade. Piso R$ 14,90. A validação visual aqui é
// conveniência; quem garante o mínimo é a RPC + o CHECK no banco.
// Member NUNCA vê este componente (só monta dentro do ProfessionalPanel).

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MIN_LABEL = BRL.format(MEMBER_PRICE_MIN_CENTS / 100)

function parseReaisToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

interface CommunityPriceSettingsProps {
  communityId: string
}

export function CommunityPriceSettings({ communityId }: CommunityPriceSettingsProps) {
  const { settings, loading, setPrice } = useCommunityBillingSettings(communityId)
  const [priceInput, setPriceInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (settings) {
      setPriceInput(BRL.format(settings.price_cents / 100).replace(/[R$\s]/g, ''))
    }
  }, [settings])

  if (loading) return <p>Carregando preço da comunidade...</p>

  const parsedCents = parseReaisToCents(priceInput)
  const belowMin = parsedCents !== null && parsedCents < MEMBER_PRICE_MIN_CENTS
  const canSave =
    parsedCents !== null &&
    parsedCents >= MEMBER_PRICE_MIN_CENTS &&
    parsedCents !== settings?.price_cents

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (parsedCents === null || parsedCents < MEMBER_PRICE_MIN_CENTS) {
      setMessage({ type: 'error', text: `O preço mínimo da assinatura é ${MIN_LABEL}.` })
      return
    }
    setBusy(true)
    setMessage(null)
    const { error } = await setPrice(parsedCents, settings?.billing_cycle ?? 'MONTHLY')
    setBusy(false)
    if (error) {
      setMessage({ type: 'error', text: `Não foi possível salvar. O mínimo é ${MIN_LABEL}.` })
      return
    }
    setMessage({ type: 'success', text: 'Preço da comunidade atualizado.' })
  }

  return (
    <section className="community-card community-card--quiet">
      <p className="section-label">Preço da assinatura da sua comunidade</p>

      {settings && (
        <p>
          Preço atual: <strong>{BRL.format(settings.price_cents / 100)}</strong> / mês
        </p>
      )}

      {message && (
        <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>{message.text}</p>
      )}

      <form onSubmit={handleSubmit} className="question-form">
        <label htmlFor="community-price">Novo preço mensal (mínimo {MIN_LABEL})</label>
        <input
          id="community-price"
          type="text"
          inputMode="decimal"
          value={priceInput}
          onChange={(event) => setPriceInput(event.target.value)}
          placeholder="14,90"
          required
        />
        {belowMin && <p className="auth-error">O preço mínimo da assinatura é {MIN_LABEL}.</p>}
        <button type="submit" disabled={busy || !canSave}>
          {busy ? 'Salvando...' : 'Salvar preço'}
        </button>
      </form>
    </section>
  )
}
