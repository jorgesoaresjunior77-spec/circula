export type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'
export type SubscriptionSubject = 'platform' | 'community'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'blocked'
export type CalculatedSubscriptionState =
  | 'trial'
  | 'trial_ending'
  | 'trial_expired'
  | 'active'
  | 'renewing_soon'
  | 'past_due'
  | 'canceled'
  | 'blocked'

export interface BillingPlan {
  id: string
  code: string
  name: string
  price_cents: number
  billing_cycle: BillingCycle
}

export interface Subscription {
  id: string
  subject: SubscriptionSubject
  community_id: string | null
  plan_id: string
  status: SubscriptionStatus
  trial_ends_at: string
  current_period_end: string
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
}

export type DocumentType = 'CPF' | 'CNPJ'

export type SubscriptionActionResult = { error: string | null }

// FASE 16.1 — vínculo da conta Asaas da Professional (recebedora do
// split). Só campos não sensíveis; a API Key nunca chega ao cliente.
export type PayoutMethod = 'asaas_split' | 'manual'

export interface ProfessionalBillingAccount {
  asaas_wallet_id: string | null
  payout_method: PayoutMethod
  verified_at: string | null
  asaas_account_name: string | null
  asaas_account_status: string | null
}

// FASE 16.1-P — preço da assinatura por comunidade (Regra de Produto 2).
// R$ 14,90 é o PISO, não um preço fixo. O enforcement real é o CHECK no
// banco + a RPC set_community_price; a constante abaixo é só validação
// visual.
export const MEMBER_PRICE_MIN_CENTS = 1490

export type CommunityBillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'

export interface CommunityBillingSettings {
  community_id: string
  price_cents: number
  billing_cycle: CommunityBillingCycle
  currency: 'BRL'
  updated_at: string
}
