import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import { ADDON_NAMES, isAddonPlanKey } from '../_shared/addonPlans.ts'

// Cancela uma assinatura AVULSA (conteúdos, Meu Chef, Premium) da própria
// membro. Segue a mesma regra da assinatura da comunidade: cancela a cobrança
// recorrente no Asaas e marca a linha como "canceled", mas o acesso continua
// até o fim do período já pago (current_period_end). Quem retira o acesso
// depois é a rotina diária (billing-daily-sweep). Nada é apagado.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return json({ error: 'Sem sessão ativa.' }, 401)

    const body = await req.json().catch(() => ({}))
    const addonId = typeof body?.addon_id === 'string' ? body.addon_id : ''
    if (!addonId) return json({ error: 'Informe a assinatura.', code: 'INVALID_INPUT' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: addon } = await admin
      .from('addon_subscriptions')
      .select('id, profile_id, community_id, plan_key, status, asaas_subscription_id, current_period_end')
      .eq('id', addonId)
      .maybeSingle()
    if (!addon) return json({ error: 'Assinatura não encontrada.' }, 404)

    if (addon.profile_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'master') return json({ error: 'Sem permissão para cancelar esta assinatura.' }, 403)
    }

    // Idempotente: já cancelada, nada a fazer.
    if (addon.status === 'canceled') {
      return json({ ok: true, alreadyCanceled: true, accessUntil: addon.current_period_end })
    }

    const asaasSubId = addon.asaas_subscription_id as string | null
    if (asaasSubId && !asaasSubId.startsWith('__provisioning__')) {
      await asaasFetch(`/subscriptions/${asaasSubId}`, { method: 'DELETE' })
    }

    const { error: updateError } = await admin
      .from('addon_subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', addonId)
      .neq('status', 'canceled')
    if (updateError) {
      console.error('asaas-cancel-addon-subscription: falha ao marcar cancelada', updateError)
      return json({ error: 'Não foi possível cancelar agora. Tente novamente.' }, 500)
    }

    try {
      const name = isAddonPlanKey(addon.plan_key) ? ADDON_NAMES[addon.plan_key] : 'Plano'
      await admin.from('notifications').insert({
        profile_id: addon.profile_id,
        type: 'billing',
        title: `${name} cancelado`,
        body: 'Sua assinatura foi cancelada e não será cobrada de novo. O acesso continua até o fim do período já pago.',
      })
    } catch (notifyError) {
      console.error('asaas-cancel-addon-subscription: falha ao notificar', notifyError)
    }

    return json({ ok: true, accessUntil: addon.current_period_end })
  } catch (error) {
    console.error('asaas-cancel-addon-subscription: erro', error)
    return json({ error: 'Não foi possível cancelar agora. Tente novamente.' }, 500)
  }
})
