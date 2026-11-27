import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import { packagesForPlan } from '../_shared/addonPlans.ts'
import type { AddonPlanKey } from '../_shared/addonPlans.ts'

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
    if (subscription.status === 'canceled' || (subscription.status === 'blocked' && subscription.canceled_at)) {
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
    // DECISÃO DE PRODUTO (2026-11-23): cancelar CORTA O ACESSO NA HORA. A assinatura vai
    // direto para 'blocked' (com canceled_at) e o fim do período passa a ser agora.
    const nowIso = new Date().toISOString()
    await admin
      .from('subscriptions')
      .update({ status: 'blocked', canceled_at: nowIso, current_period_end: nowIso })
      .eq('id', subscriptionId)
      .neq('status', 'canceled')

    // Cancelar a mensalidade do Círcula cancela TUDO: todas as assinaturas
    // avulsas e o Premium da mesma pessoa (cobrança recorrente no Asaas e
    // status). Segue a mesma regra de acesso: vale até o fim do período já
    // pago de cada uma. Falha em uma não impede as outras nem o cancelamento
    // principal (já feito acima).
    let cancelledAddons = 0
    try {
      const { data: addons } = await admin
        .from('addon_subscriptions')
        .select('id, asaas_subscription_id, community_id, plan_key, bundle_keys')
        .eq('profile_id', subscription.profile_id)
        .neq('status', 'canceled')
      for (const addon of addons ?? []) {
        try {
          const id = addon.asaas_subscription_id as string | null
          if (id && !id.startsWith('__provisioning__')) {
            await asaasFetch(`/subscriptions/${id}`, { method: 'DELETE' })
          }
          await admin
            .from('addon_subscriptions')
            .update({ status: 'canceled', current_period_end: nowIso, updated_at: nowIso })
            .eq('id', addon.id)
            .neq('status', 'canceled')
          // acesso cortado na hora: tira os pacotes que esse plano liberava
          for (const pkg of packagesForPlan(addon.plan_key as AddonPlanKey, addon.bundle_keys as string[] | null)) {
            await admin
              .from('member_package_access')
              .delete()
              .eq('community_id', addon.community_id as string)
              .eq('profile_id', subscription.profile_id)
              .eq('package', pkg)
              .is('granted_by', null) // liberado à mão pela equipe (cortesia): nunca sai sozinho
          }
          cancelledAddons += 1
        } catch (addonError) {
          console.error('asaas-cancel-subscription: falha ao cancelar avulsa', addon.id, addonError)
        }
      }
    } catch (addonsError) {
      console.error('asaas-cancel-subscription: falha ao listar avulsas', addonsError)
    }

    // FASE 16.2.4-C — aviso de cancelamento (à prova de exceção: uma falha
    // aqui nunca desfaz nem bloqueia o cancelamento).
    try {
      await admin.from('notifications').insert({
        profile_id: subscription.profile_id,
        type: 'billing',
        title: 'Assinatura cancelada',
        body: cancelledAddons > 0
          ? 'Sua assinatura do Círcula foi cancelada e, junto com ela, todos os planos avulsos e o Premium. O acesso foi encerrado agora, na hora. Nenhum dado foi apagado. Para voltar, assine de novo em Planos.'
          : 'Sua assinatura foi cancelada. O acesso foi encerrado agora, na hora. Nenhum dado foi apagado. Para voltar, assine de novo em Planos.',
        related_subscription_id: subscriptionId,
      })
    } catch (notifyError) {
      console.error('asaas-cancel-subscription: falha ao notificar cancelamento', notifyError)
    }

    return new Response(JSON.stringify({ ok: true, cancelledAddons }), {
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
