import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CalculatedSubscriptionState,
  DocumentType,
  Subscription,
  SubscriptionSubject,
} from '../types/billing'

interface UseSubscriptionOptions {
  subject: SubscriptionSubject
  communityId?: string
}

export function useSubscription({ subject, communityId }: UseSubscriptionOptions) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [calculatedState, setCalculatedState] = useState<CalculatedSubscriptionState | null>(null)
  const [hasBillingCustomerData, setHasBillingCustomerData] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)

    let query = supabase.from('subscriptions').select('*').eq('subject', subject).neq('status', 'canceled')
    query = communityId ? query.eq('community_id', communityId) : query.is('community_id', null)

    const { data: subRow } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
    setSubscription(subRow ?? null)

    if (subRow) {
      const { data: state } = await supabase.rpc('calculate_subscription_state', {
        p_subscription_id: subRow.id,
      })
      setCalculatedState((state as CalculatedSubscriptionState) ?? null)
    } else {
      setCalculatedState(null)
    }

    const { data: billingData } = await supabase.from('billing_customer_data').select('id').maybeSingle()
    setHasBillingCustomerData(!!billingData)

    setLoading(false)
  }, [subject, communityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function saveBillingCustomerData(documentType: DocumentType, documentNumber: string) {
    const digits = documentNumber.replace(/\D/g, '')
    const expectedLength = documentType === 'CPF' ? 11 : 14

    if (digits.length !== expectedLength) {
      return { error: `${documentType} deve ter ${expectedLength} dígitos.` }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return { error: 'Sem sessão ativa.' }

    const { error: upsertError } = await supabase.from('billing_customer_data').upsert(
      { profile_id: userData.user.id, document_type: documentType, document_number: digits },
      { onConflict: 'profile_id' },
    )

    if (upsertError) return { error: upsertError.message }

    setHasBillingCustomerData(true)
    return { error: null }
  }

  async function createSubscription(planCode: string) {
    const { data, error: invokeError } = await supabase.functions.invoke('asaas-create-subscription', {
      body: { subject, community_id: communityId, plan_code: planCode },
    })

    if (invokeError) return { error: invokeError.message, invoiceUrl: null as string | null }

    await refresh()
    return { error: null, invoiceUrl: (data?.invoiceUrl as string | undefined) ?? null }
  }

  async function cancelSubscription() {
    if (!subscription) return { error: 'Nenhuma assinatura para cancelar.' }

    const { error: invokeError } = await supabase.functions.invoke('asaas-cancel-subscription', {
      body: { subscription_id: subscription.id },
    })

    if (invokeError) return { error: invokeError.message }

    await refresh()
    return { error: null }
  }

  return {
    subscription,
    calculatedState,
    hasBillingCustomerData,
    loading,
    saveBillingCustomerData,
    createSubscription,
    cancelSubscription,
    refresh,
  }
}
