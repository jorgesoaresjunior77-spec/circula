import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// FASE 16.1 — Desconectar a conta Asaas da Professional
// =====================================================================
// A Professional autenticada desfaz o vínculo da própria conta Asaas.
// Efeito: `asaas_wallet_id` volta a NULL, `payout_method` volta a
// 'manual', `verified_at` volta a NULL e `disconnected_at` é marcado.
//
// Com isso, `resolve_split()` deixa de devolver `split_model='native'`
// para as vendas/assinaturas dessa comunidade (volta a 'ledger') — sem
// tocar em nenhuma cobrança já criada (os snapshots ficam congelados).
//
// SEGURANÇA:
//   - valida o JWT; só mexe na PRÓPRIA linha (`profile_id = user.id`);
//   - `service_role` só aqui dentro (a tabela não tem policy de UPDATE
//     para `authenticated`);
//   - não chama a Asaas, não lida com credenciais.
// =====================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return json({ error: 'Sem sessão ativa.' }, 401)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: existing } = await admin
      .from('professional_billing_accounts')
      .select('id, verified_at')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!existing) {
      return json({ error: 'Nenhuma conta Asaas conectada.' }, 404)
    }

    const { error: updateError } = await admin
      .from('professional_billing_accounts')
      .update({
        asaas_wallet_id: null,
        payout_method: 'manual',
        verified_at: null,
        disconnected_at: new Date().toISOString(),
      })
      .eq('profile_id', user.id)

    if (updateError) {
      console.error('disconnect-asaas-account: update falhou', updateError.message)
      return json({ error: 'Não foi possível desconectar agora.' }, 500)
    }

    return json({ disconnected: true }, 200)
  } catch (error) {
    console.error('disconnect-asaas-account: erro inesperado', (error as Error).message)
    return new Response(JSON.stringify({ error: 'Erro inesperado.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
