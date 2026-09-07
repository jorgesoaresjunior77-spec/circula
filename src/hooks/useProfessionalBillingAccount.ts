import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfessionalBillingAccount } from '../types/billing'

// FASE 16.1 — lê o vínculo da conta Asaas da Professional logada.
// Cliente anon + RLS (`professional_billing_accounts_select` =
// `profile_id = auth.uid() or is_master()`). O frontend NUNCA escreve
// esta tabela — connect/disconnect passam por Edge Functions.
export function useProfessionalBillingAccount(enabled: boolean) {
  const [account, setAccount] = useState<ProfessionalBillingAccount | null>(null)
  const [loading, setLoading] = useState(enabled)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setAccount(null)
      setLoading(false)
      return
    }
    setLoading(true)
    // `select('*')` (padrão da casa, cf. useSubscription). A linha é a do
    // próprio perfil (RLS `profile_id = auth.uid()`); a UI só renderiza
    // nome/status da conta — nunca o walletId nem credencial.
    const { data } = await supabase.from('professional_billing_accounts').select('*').maybeSingle()
    setAccount((data as ProfessionalBillingAccount | null) ?? null)
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Extrai a mensagem de erro do corpo da resposta da Edge Function
  // (FunctionsHttpError guarda o Response em `context`).
  async function readInvokeError(error: unknown, fallback: string): Promise<string> {
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json()
        if (body && typeof body.error === 'string') return body.error
      }
    } catch {
      // ignora — usa o fallback
    }
    return fallback
  }

  async function connect(asaasApiKey: string) {
    const { error } = await supabase.functions.invoke('connect-asaas-account', {
      body: { asaas_api_key: asaasApiKey },
    })
    if (error) {
      return { error: await readInvokeError(error, 'Não foi possível conectar a conta Asaas agora.') }
    }
    await refresh()
    return { error: null as string | null }
  }

  async function disconnect() {
    const { error } = await supabase.functions.invoke('disconnect-asaas-account', { body: {} })
    if (error) {
      return { error: await readInvokeError(error, 'Não foi possível desconectar agora.') }
    }
    await refresh()
    return { error: null as string | null }
  }

  const connected = !!account?.verified_at && account.payout_method === 'asaas_split'

  return { account, connected, loading, connect, disconnect, refresh }
}
