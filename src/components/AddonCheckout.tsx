import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAddonCheckout } from '../hooks/useAddonCheckout'
import { useSubscription } from '../hooks/useSubscription'
import { useMyAddonSubscription } from '../hooks/useMyAddonSubscription'
import { CYCLE_LABEL, formatBrl } from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import type { DocumentType } from '../types/billing'
import { RoboInsiste } from './RoboPlanos'

// Assinar um conteúdo avulso (Respiração, Wellness): pede o CPF/CNPJ uma vez,
// a membro escolhe o ciclo e o Asaas abre a fatura em outra aba. O acesso é
// liberado sozinho quando o pagamento é confirmado.

// O anual vem primeiro (já escolhido) e o semestral é a segunda opção; o mensal continua disponível.
const CYCLES: PlanCycle[] = ['annual', 'semiannual', 'monthly']

const CODE_MESSAGES: Record<string, string> = {
  MISSING_BILLING_DATA: 'Cadastre seu CPF/CNPJ antes de assinar.',
  NOT_ACTIVE_MEMBER: 'Você precisa ter a entrada aprovada na comunidade para assinar.',
}

export function AddonCheckout({
  planKey,
  communityId,
  prices,
  owned,
  profileId = null,
  viaPremium = false,
  onCheckoutStarted,
}: {
  planKey: string
  communityId: string | null
  prices: Record<PlanCycle, number>
  /** Já tem este plano (ou o Premium): só avisa. */
  owned: boolean
  /** Quem está vendo (para achar a assinatura dela e permitir cancelar). */
  profileId?: string | null
  /** A membro tem o Premium: este conteúdo já está incluído nele. */
  viaPremium?: boolean
  /** Chamado quando a fatura foi aberta (a página passa a esperar a confirmação do pagamento). */
  onCheckoutStarted?: (cycle: PlanCycle) => void
}) {
  const { hasBillingCustomerData, saveBillingCustomerData } = useSubscription({
    subject: 'community',
    communityId: communityId ?? undefined,
  })
  const { subscribe, busy } = useAddonCheckout(communityId)
  const mine = useMyAddonSubscription(communityId, profileId, planKey)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cycle, setCycle] = useState<PlanCycle>('annual')
  const [documentType, setDocumentType] = useState<DocumentType>('CPF')
  const [documentNumber, setDocumentNumber] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  if (owned) {
    const canceled = mine.sub?.status === 'canceled'
    // Incluído no Premium e sem assinatura separada: nada a cancelar aqui.
    if (viaPremium && planKey !== 'premium' && !mine.sub) {
      return <p className="auth-success">Incluído no seu Círcula Premium. Não precisa assinar nem cancelar separado.</p>
    }
    return (
      <div className="addon-checkout">
        <p className="auth-success">
          {canceled ? 'Assinatura cancelada. O acesso foi encerrado na hora.' : 'Você já tem este plano. Aproveite!'}
        </p>
        {mine.sub && mine.sub.plan_key === 'cesta' && !canceled && (
          <p className="home-muted">Este conteúdo faz parte da sua cesta. Cancelar a assinatura cancela a cesta inteira, e todos os conteúdos dela saem na hora.</p>
        )}
        {viaPremium && planKey !== 'premium' && mine.sub && !canceled && (
          <p className="home-muted">Este conteúdo já está incluído no seu Premium. Esta assinatura separada pode ser cancelada para não pagar em dobro.</p>
        )}
        {mine.sub && !canceled && !confirmingCancel && (
          <button type="button" className="water-link" onClick={() => setConfirmingCancel(true)}>
            Cancelar assinatura
          </button>
        )}
        {mine.sub && !canceled && confirmingCancel && (
          <div className="question-item-actions">
            <p className="home-muted">
              Atenção: ao cancelar, a cobrança para e o seu acesso a este plano é cortado agora, na hora, mesmo que o período já esteja pago.
            </p>
            <button
              type="button"
              className="question-delete-button"
              disabled={mine.busy}
              onClick={() => void mine.cancel().then(() => setConfirmingCancel(false))}
            >
              {mine.busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
            <button type="button" onClick={() => setConfirmingCancel(false)} disabled={mine.busy}>
              Voltar
            </button>
          </div>
        )}
        {mine.error && <p className="auth-error">{mine.error}</p>}
      </div>
    )
  }
  if (!communityId) return <p className="home-muted">Entre em uma comunidade para assinar.</p>

  async function handleSaveDocument(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await saveBillingCustomerData(documentType, documentNumber)
    setSaving(false)
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Dados de cobrança salvos.' })
  }

  async function handleSubscribe() {
    setMessage(null)
    const { error, code, invoiceUrl } = await subscribe(planKey, cycle)
    if (error) {
      setMessage({ ok: false, text: (code && CODE_MESSAGES[code]) || error })
      return
    }
    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank')
      setMessage({ ok: true, text: 'Conclua o pagamento na página que abriu em outra aba. O acesso libera quando o pagamento é confirmado.' })
      onCheckoutStarted?.(cycle)
      return
    }
    setMessage({ ok: true, text: 'Assinatura registrada. Aguarde a confirmação do pagamento.' })
    onCheckoutStarted?.(cycle)
  }

  return (
    <div className="addon-checkout">
      {hasBillingCustomerData === false && (
        <form onSubmit={(e) => void handleSaveDocument(e)} className="question-form">
          <label htmlFor="addon-doc-type">Tipo de documento</label>
          <select id="addon-doc-type" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
          <label htmlFor="addon-doc-number">{documentType}</label>
          <input
            id="addon-doc-number"
            type="text"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
            required
          />
          <button type="submit" disabled={saving || !documentNumber.trim()}>
            {saving ? 'Salvando...' : 'Salvar dados de cobrança'}
          </button>
        </form>
      )}

      {hasBillingCustomerData && (
        <>
          <div className="addon-cycles" role="radiogroup" aria-label="Ciclo de cobrança">
            {CYCLES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                className={`schedule-type${cycle === c ? ' schedule-type--on' : ''}`}
                onClick={() => setCycle(c)}
              >
                {CYCLE_LABEL[c]} · {formatBrl(prices[c])}
                {c === 'annual' && <small className="addon-cycle-best"> · Melhor escolha agora</small>}
              </button>
            ))}
          </div>
          <RoboInsiste cycle={cycle} prices={prices} onPick={setCycle} />
          <button type="button" className="water-primary" onClick={() => void handleSubscribe()} disabled={busy}>
            {busy ? 'Abrindo…' : `Assinar ${CYCLE_LABEL[cycle].toLowerCase()}`}
          </button>
        </>
      )}

      {message && <p className={message.ok ? 'auth-success' : 'auth-error'}>{message.text}</p>}
    </div>
  )
}
