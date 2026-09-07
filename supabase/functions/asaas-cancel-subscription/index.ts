import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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
      return new Response(JSON.stringify({ error: 'Sem sessão ativa.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { subscription_id: subscriptionId } = await req.json()

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('asaas-cancel-subscription: falha ao buscar profile', profileError)
      return new Response(JSON.stringify({ error: 'Erro ao buscar dados do perfil.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle()

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Assinatura não encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (subscription.profile_id !== user.id && profile?.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Sem permissão para cancelar esta assinatura.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // FASE 16.2.4-C — idempotência: já cancelada -> nada a fazer (não
    // re-deleta na Asaas, não reescreve o status, não re-notifica).
    if (subscription.status === 'canceled') {
      return new Response(JSON.stringify({ ok: true, alreadyCanceled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const asaasSubId = subscription.asaas_subscription_id as string | null
    // Só chama a Asaas com um id REAL. Um lock de provisioning da I-1
    // (`__provisioning__:<ISO>`) não é uma assinatura Asaas — DELETE nele
    // daria 404 e derrubaria o cancelamento.
    if (asaasSubId && !asaasSubId.startsWith('__provisioning__')) {
      await asaasFetch(`/subscriptions/${asaasSubId}`, { method: 'DELETE' })
    }

    // FASE 16.2.4-C (decisão de produto fechada) — NÃO altera
    // `trial_ends_at` nem `current_period_end`; NÃO bloqueia
    // imediatamente. `current_period_end` = "acesso válido até":
    //   • trial cancelado  -> acesso até o fim do período de trial já
    //     concedido (nesse ponto o sweep aplica o fluxo normal: blocked);
    //   • assinatura paga cancelada -> acesso até o fim do período já pago.
    // O sweep é quem transiciona `canceled -> blocked` quando esse prazo
    // passa. Histórico financeiro (payment_charges / subscription_payouts)
    // preservado integralmente.
    await admin
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', subscriptionId)
      .neq('status', 'canceled')

    // FASE 16.2.4-C — aviso de cancelamento (à prova de exceção: uma falha
    // aqui nunca desfaz nem bloqueia o cancelamento).
    try {
      await admin.from('notifications').insert({
        profile_id: subscription.profile_id,
        type: 'billing',
        title: 'Assinatura cancelada',
        body: 'Sua assinatura foi cancelada. O acesso continua até o fim do período já concedido; depois disso ele é encerrado. Nenhum dado foi apagado.',
        related_subscription_id: subscriptionId,
      })
    } catch (notifyError) {
      console.error('asaas-cancel-subscription: falha ao notificar cancelamento', notifyError)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
