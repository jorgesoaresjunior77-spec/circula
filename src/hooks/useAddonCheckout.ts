import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanCycle } from '../lib/plansCatalog'

// Assinatura avulsa (Respiração, Wellness...). O servidor decide o preço; aqui
// só se manda o plano, o ciclo e a comunidade. O pagamento acontece na fatura
// do Asaas (link devolvido pelo servidor).

const API_CYCLE: Record<PlanCycle, 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'> = {
  monthly: 'MONTHLY',
  semiannual: 'SEMIANNUALLY',
  annual: 'YEARLY',
}

export interface AddonCheckoutResult {
  error: string | null
  code?: string
  invoiceUrl: string | null
}

export function useAddonCheckout(communityId: string | null) {
  const [busy, setBusy] = useState(false)

  const subscribe = useCallback(
    async (planKey: string, cycle: PlanCycle): Promise<AddonCheckoutResult> => {
      if (!communityId) return { error: 'Entre em uma comunidade para assinar.', invoiceUrl: null }
      setBusy(true)
      const { data, error } = await supabase.functions.invoke('asaas-create-addon-subscription', {
        body: { plan_key: planKey, billing_cycle: API_CYCLE[cycle], community_id: communityId },
      })
      setBusy(false)
      if (error) {
        let message = 'Não foi possível assinar agora. Tente novamente em instantes.'
        let code: string | undefined
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          try {
            const parsed = (await ctx.json()) as { error?: string; code?: string }
            if (typeof parsed?.error === 'string') message = parsed.error
            if (typeof parsed?.code === 'string') code = parsed.code
          } catch {
            /* mantém a mensagem genérica */
          }
        }
        return { error: message, code, invoiceUrl: null }
      }
      return { error: null, invoiceUrl: (data?.invoiceUrl as string | undefined) ?? null }
    },
    [communityId],
  )

  return { subscribe, busy }
}
