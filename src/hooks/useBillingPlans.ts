import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BillingPlan, SubscriptionSubject } from '../types/billing'

export function useBillingPlans(subject: SubscriptionSubject) {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    supabase
      .from('billing_plans')
      .select('id, code, name, price_cents, billing_cycle')
      .eq('subject', subject)
      .eq('is_active', true)
      .order('price_cents')
      .then(({ data }) => {
        if (!active) return
        setPlans(data ?? [])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [subject])

  return { plans, loading }
}
