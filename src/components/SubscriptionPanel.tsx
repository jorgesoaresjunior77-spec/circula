import { useState } from 'react'
import type { FormEvent } from 'react'
import { useBillingPlans } from '../hooks/useBillingPlans'
import { useSubscription } from '../hooks/useSubscription'
import type { DocumentType, SubscriptionSubject } from '../types/billing'

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATE_LABELS: Record<string, string> = {
  trial: 'Período de teste',
  trial_ending: 'Período de teste terminando',
  trial_expired: 'Período de teste encerrado',
  active: 'Assinatura ativa',
  renewing_soon: 'Renovando em breve',
  past_due: 'Pagamento pendente',
  canceled: 'Assinatura cancelada',
  blocked: 'Acesso bloqueado',
}

interface SubscriptionPanelProps {
  subject?: SubscriptionSubject
  communityId?: string
}

export function SubscriptionPanel({ subject = 'platform', communityId }: SubscriptionPanelProps) {
  const { plans } = useBillingPlans(subject)
  const {
    subscription,
    calculatedState,
    hasBillingCustomerData,
    loading,
    saveBillingCustomerData,
    createSubscription,
    cancelSubscription,
  } = useSubscription({ subject, communityId })

  const [documentType, setDocumentType] = useState<DocumentType>('CPF')
  const [documentNumber, setDocumentNumber] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSaveDocument(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const { error } = await saveBillingCustomerData(documentType, documentNumber)

    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }

    setMessage({ type: 'success', text: 'Dados de cobrança salvos.' })
  }

  async function handleSubscribe(planCode: string) {
    setSelectedPlan(planCode)
    setSubmitting(true)
    setMessage(null)

    const { error, invoiceUrl } = await createSubscription(planCode)

    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }

    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank')
    }

    setMessage({ type: 'success', text: 'Assinatura criada na Asaas Sandbox.' })
  }

  async function handleCancel() {
    setSubmitting(true)
    setMessage(null)

    const { error } = await cancelSubscription()

    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }

    setMessage({ type: 'success', text: 'Assinatura cancelada.' })
  }

  if (loading) {
    return <p>Carregando assinatura...</p>
  }

  return (
    <div className="panel-tab-content">
      {subscription && (
        <p>
          Status: <strong>{STATE_LABELS[calculatedState ?? subscription.status] ?? subscription.status}</strong>
        </p>
      )}

      {message && (
        <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>{message.text}</p>
      )}

      {hasBillingCustomerData === false && (
        <form onSubmit={handleSaveDocument} className="question-form">
          <label htmlFor={`document-type-${subject}`}>Tipo de documento</label>
          <select
            id={`document-type-${subject}`}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as DocumentType)}
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>

          <label htmlFor={`document-number-${subject}`}>{documentType}</label>
          <input
            id={`document-number-${subject}`}
            type="text"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
            required
          />

          <button type="submit" disabled={submitting || !documentNumber.trim()}>
            {submitting ? 'Salvando...' : 'Salvar dados de cobrança'}
          </button>
        </form>
      )}

      {hasBillingCustomerData && !subscription?.asaas_subscription_id && (
        <div className="question-item-actions">
          {plans.map((plan) => (
            <button
              key={plan.code}
              type="button"
              onClick={() => handleSubscribe(plan.code)}
              disabled={submitting}
            >
              {selectedPlan === plan.code && submitting
                ? 'Assinando...'
                : `${plan.name} — ${BRL_FORMATTER.format(plan.price_cents / 100)}`}
            </button>
          ))}
        </div>
      )}

      {subscription?.asaas_subscription_id && subscription.status !== 'canceled' && (
        <div className="question-item-actions">
          <button type="button" className="question-delete-button" onClick={handleCancel} disabled={submitting}>
            {submitting ? 'Cancelando...' : 'Cancelar assinatura'}
          </button>
        </div>
      )}
    </div>
  )
}
