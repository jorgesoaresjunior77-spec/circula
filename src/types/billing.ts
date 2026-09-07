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
  // FASE 16.2.4-B — snapshot financeiro congelado no checkout de comunidade.
  // Nulos para assinaturas de plataforma e para assinaturas de comunidade
  // ainda em trial (antes do primeiro checkout).
  price_cents_snapshot?: number | null
  billing_cycle_snapshot?: BillingCycle | null
  currency_snapshot?: string | null
  split_model_snapshot?: SplitModel | null
  circula_percent_snapshot?: number | null
  circula_amount_cents_snapshot?: number | null
  professional_amount_cents_snapshot?: number | null
  professional_wallet_id_snapshot?: string | null
}

// FASE 16.2.4-B — modelo de rateio da assinatura de comunidade.
export type SplitModel = 'native' | 'ledger'
export type PayoutKind = 'sale' | 'reversal'
export type PayoutStatus = 'paid' | 'pending' | 'reversed'

// Extrato de repasse da Professional (uma linha por cobrança confirmada /
// por reversão). Escrito só pela Edge Function asaas-webhook.
export interface SubscriptionPayout {
  id: string
  subscription_id: string
  payment_charge_id: string | null
  community_id: string
  professional_id: string
  kind: PayoutKind
  split_model: SplitModel
  gross_amount_cents: number
  asaas_fee_cents: number
  circula_fee_cents: number
  net_amount_cents: number
  status: PayoutStatus
  created_at: string
  reversed_at: string | null
}

// Cobrança de assinatura + reconciliação de split reportada pela Asaas.
export interface PaymentCharge {
  id: string
  subscription_id: string
  asaas_payment_id: string | null
  status: string
  amount_cents: number
  due_date: string
  paid_at: string | null
  invoice_url: string | null
  net_value_cents: number | null
  split_professional_cents: number | null
  split_circula_cents: number | null
  asaas_fee_cents: number | null
}

// FASE P1-A — aba "Recebimentos" do painel da Professional.
// Deriva EXCLUSIVAMENTE de `subscription_payouts` (+ `subscriptions` para o
// snapshot de % e ciclo, + `profiles` para o nome do Member). Nenhum campo
// sensível (walletId, customer_id, API key) é lido.
export type RevenuePeriod = '30d' | '90d' | 'year' | 'all'

export interface RevenueRow {
  id: string
  kind: PayoutKind
  splitModel: SplitModel
  status: PayoutStatus
  createdAt: string
  reversedAt: string | null
  grossCents: number
  asaasFeeCents: number
  circulaFeeCents: number
  netAmountCents: number // valor destinado à Professional
  netValueCents: number // líquido processado (bruto − taxa Asaas)
  circulaPercent: number | null
  billingCycle: BillingCycle | null
  subscriptionId: string
  memberName: string | null
}

export interface RevenueSummary {
  professionalPaidCents: number // já repassado à Professional (sale/paid − reversões)
  professionalPendingCents: number // devido à Professional, ainda não repassado (sale/pending)
  circulaPaidCents: number // parcela do Círcula (sale/paid − reversões)
  grossPaidCents: number // bruto processado (sale/paid − reversões)
  asaasFeePaidCents: number // taxa Asaas (sale/paid − reversões)
  paidCount: number
  pendingCount: number
  reversedCount: number
  lastPayout:
    | { createdAt: string; netAmountCents: number; status: PayoutStatus; kind: PayoutKind }
    | null
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
