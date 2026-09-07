import { useState } from 'react'
import type { FormEvent } from 'react'
import { useBillingNotices } from '../hooks/useBillingNotices'
import { useBillingPlans } from '../hooks/useBillingPlans'
import { useCommunityBillingSettings } from '../hooks/useCommunityBillingSettings'
import { useSubscription } from '../hooks/useSubscription'
import type { DocumentType, Subscription, SubscriptionSubject } from '../types/billing'

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MS_PER_DAY = 24 * 60 * 60 * 1000
function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY))
}

// FASE 16.2.4-C — linha de detalhe do ciclo de cobrança (derivada de
// `calculate_subscription_state` + datas da assinatura; sem leitura extra).
function billingDetail(state: string | null, sub: Subscription): string | null {
  switch (state) {
    case 'trial':
      return `Período de teste — faltam ${daysUntil(sub.trial_ends_at)} dia(s).`
    case 'trial_ending':
      return `Seu período de teste está terminando (${daysUntil(sub.trial_ends_at)} dia(s)).`
    case 'trial_expired':
      return 'Seu período de teste terminou. Assine para manter o acesso.'
    case 'renewing_soon':
      return `Sua assinatura renova em ${daysUntil(sub.current_period_end)} dia(s).`
    case 'past_due':
      return 'Há um pagamento em aberto. Regularize para não perder o acesso quando a tolerância terminar.'
    case 'blocked':
      return 'Acesso bloqueado por falta de pagamento confirmado. Regularize para retomar — nenhum dado foi apagado.'
    case 'canceled':
      return 'Assinatura cancelada. O acesso segue até o fim do período já pago.'
    default:
      return null
  }
}

// FASE 16.2.4-B — mensagens amigáveis por código de erro da Edge Function
// asaas-create-subscription (ramo de comunidade).
const CODE_MESSAGES: Record<string, string> = {
  OWNER_NOT_CONNECTED:
    'Esta comunidade ainda não está pronta para receber assinaturas. A responsável precisa concluir a conexão da conta de recebimento.',
  NOT_ACTIVE_MEMBER: 'Você precisa ter a entrada aprovada nesta comunidade antes de assinar.',
  PROVISIONING: 'Sua assinatura está sendo criada. Aguarde alguns segundos e tente novamente.',
  PRICE_BELOW_MIN: 'O preço configurado para esta comunidade é inválido. Fale com a responsável.',
  PRICE_NOT_SET: 'O preço desta comunidade ainda não foi configurado.',
  MISSING_BILLING_DATA: 'Cadastre seu CPF/CNPJ antes de assinar.',
  NO_SUBSCRIPTION: 'Não encontramos sua assinatura desta comunidade. Recarregue a página.',
  NO_SPLIT_RULE: 'A configuração de repasse da plataforma está incompleta. Tente mais tarde.',
  ASAAS_FAILED: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.',
}

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
  // FASE 16.2.4-B — no ramo de comunidade o preço vem da comunidade, não
  // dos planos globais. useCommunityBillingSettings(null) não faz fetch.
  const { settings: communitySettings } = useCommunityBillingSettings(
    subject === 'community' ? communityId ?? null : null,
  )
  const {
    subscription,
    calculatedState,
    hasBillingCustomerData,
    loading,
    saveBillingCustomerData,
    createSubscription,
    cancelSubscription,
  } = useSubscription({ subject, communityId })
  // FASE 16.2.4-C — avisos de cobrança escritos pelo sweep / cancelamento.
  const { unread: billingNotices, markRead } = useBillingNotices(subscription?.id ?? null)

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

  async function handleSubscribe(planCode?: string) {
    setSelectedPlan(planCode ?? '__community__')
    setSubmitting(true)
    setMessage(null)

    const { error, code, invoiceUrl } = await createSubscription(planCode)

    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: (code && CODE_MESSAGES[code]) || error })
      return
    }

    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank')
      setMessage({ type: 'success', text: 'Conclua o pagamento na página que abriu em outra aba.' })
      return
    }

    setMessage({ type: 'success', text: 'Assinatura registrada. Aguarde a confirmação do pagamento.' })
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

  const detail = subscription ? billingDetail(calculatedState ?? subscription.status, subscription) : null

  return (
    <div className="panel-tab-content">
      {subscription && (
        <p>
          Status: <strong>{STATE_LABELS[calculatedState ?? subscription.status] ?? subscription.status}</strong>
        </p>
      )}

      {detail && <p className="auth-subtitle">{detail}</p>}

      {/* FASE 16.2.4-C — avisos de cobrança (tabela `notifications`,
          escritos server-side pelo sweep / cancelamento). */}
      {billingNotices.length > 0 && (
        <ul className="billing-notice-list">
          {billingNotices.map((notice) => (
            <li key={notice.id} className="billing-notice">
              <span className="billing-notice-body">
                <strong>{notice.title}</strong>
                <span>{notice.body}</span>
              </span>
              <button type="button" className="auth-link" onClick={() => markRead(notice.id)}>
                Ok, entendi
              </button>
            </li>
          ))}
        </ul>
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

      {hasBillingCustomerData && subject === 'platform' && !subscription?.asaas_subscription_id && (
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

      {/* FASE 16.2.4-B — checkout de comunidade: preço da própria
          comunidade (community_billing_settings), sem escolha de plano. */}
      {hasBillingCustomerData && subject === 'community' && communitySettings && (
        <div className="question-item-actions">
          {!subscription?.asaas_subscription_id ? (
            <button type="button" onClick={() => handleSubscribe()} disabled={submitting}>
              {submitting
                ? 'Assinando...'
                : `Assinar — ${BRL_FORMATTER.format(communitySettings.price_cents / 100)}/mês`}
            </button>
          ) : subscription.status === 'blocked' || calculatedState === 'blocked' ? (
            <button type="button" onClick={() => handleSubscribe()} disabled={submitting}>
              {submitting ? 'Abrindo fatura...' : 'Regularizar pagamento'}
            </button>
          ) : null}
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
