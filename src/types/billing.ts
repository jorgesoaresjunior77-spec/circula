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
