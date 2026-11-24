import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import { ADDON_NAMES, BUNDLE_PLAN_KEY, bundlePriceCents, isAddonPlanKey, packagesForPlan, sanitizeBundle } from '../_shared/addonPlans.ts'
import type { AddonPlanKey, AsaasCycle } from '../_shared/addonPlans.ts'

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
      .select('id, profile_id, community_id, plan_key, bundle_keys, billing_cycle, status, asaas_subscription_id, current_period_end')
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

    // CESTA: cada conteúdo é independente. Cancelar UM item tira só ele da cesta, baixa o valor
    // da cobrança no Asaas e mantém os outros. Só cancela a cesta inteira quando sobra nada.
    const itemKey = typeof body?.package_key === 'string' ? body.package_key : ''
    if (addon.plan_key === BUNDLE_PLAN_KEY && itemKey) {
      const current = sanitizeBundle(addon.bundle_keys ?? [])
      if (!current.includes(itemKey as AddonPlanKey)) return json({ error: 'Esse conteúdo não está na sua cesta.', code: 'NOT_IN_BUNDLE' }, 400)
      const rest = current.filter((k) => k !== itemKey)
      if (rest.length > 0) {
        const { data: overrides } = await admin.from('product_price_overrides').select('plan_key, monthly_cents').in('plan_key', rest)
        const overrideMap: Partial<Record<AddonPlanKey, number>> = {}
        for (const o of (overrides ?? []) as { plan_key: AddonPlanKey; monthly_cents: number }[]) overrideMap[o.plan_key] = o.monthly_cents
        const cycle = addon.billing_cycle as AsaasCycle
        const newPrice = bundlePriceCents(rest, cycle, overrideMap)
        if (asaasSubId && !asaasSubId.startsWith('__provisioning__')) {
          await asaasFetch(`/subscriptions/${asaasSubId}`, {
            method: 'PUT',
            body: JSON.stringify({
              value: newPrice / 100,
              updatePendingPayments: true,
              description: `Círcula — ${rest.map((k) => ADDON_NAMES[k]).join(', ')}`.slice(0, 500),
            }),
          })
        }
        await admin
          .from('addon_subscriptions')
          .update({ bundle_keys: rest, price_cents: newPrice, updated_at: new Date().toISOString() })
          .eq('id', addonId)
        // acesso do item cortado na hora (a não ser que outra assinatura viva ainda o dê)
        const { data: others } = await admin
          .from('addon_subscriptions')
          .select('plan_key, bundle_keys')
          .eq('community_id', addon.community_id as string)
          .eq('profile_id', addon.profile_id as string)
          .in('status', ['active', 'past_due', 'pending'])
          .neq('id', addonId)
        const stillCovered = (others ?? []).some((o) => packagesForPlan(o.plan_key as AddonPlanKey, o.bundle_keys as string[] | null).includes(itemKey))
        if (!stillCovered) {
          await admin
            .from('member_package_access')
            .delete()
            .eq('community_id', addon.community_id as string)
            .eq('profile_id', addon.profile_id as string)
            .eq('package', itemKey)
        }
        try {
          await admin.from('notifications').insert({
            profile_id: addon.profile_id,
            type: 'billing',
            title: `${ADDON_NAMES[itemKey as AddonPlanKey]} cancelado`,
            body: `Esse conteúdo saiu da sua cesta e o acesso foi encerrado agora. Os outros continuam normalmente e a próxima cobrança já vem com o valor menor.`,
          })
        } catch (notifyError) {
          console.error('asaas-cancel-addon-subscription: falha ao notificar item da cesta', notifyError)
        }
        return json({ ok: true, itemRemoved: itemKey, remaining: rest, accessUntil: addon.current_period_end })
      }
      // era o último item: segue para o cancelamento completo abaixo
    }

    if (asaasSubId && !asaasSubId.startsWith('__provisioning__')) {
      await asaasFetch(`/subscriptions/${asaasSubId}`, { method: 'DELETE' })
    }

    const { error: updateError } = await admin
      .from('addon_subscriptions')
      .update({ status: 'canceled', current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', addonId)
      .neq('status', 'canceled')
    if (updateError) {
      console.error('asaas-cancel-addon-subscription: falha ao marcar cancelada', updateError)
      return json({ error: 'Não foi possível cancelar agora. Tente novamente.' }, 500)
    }

    // DECISÃO DE PRODUTO (2026-11-23): cancelar corta o acesso na hora. Só mantém o pacote
    // se a membro tiver OUTRA assinatura viva do mesmo plano.
    if (isAddonPlanKey(addon.plan_key) || addon.plan_key === BUNDLE_PLAN_KEY) {
      const { data: stillActive } = await admin
        .from('addon_subscriptions')
        .select('id')
        .eq('community_id', addon.community_id as string)
        .eq('profile_id', addon.profile_id as string)
        .eq('plan_key', addon.plan_key as string)
        .in('status', ['active', 'past_due', 'pending'])
        .neq('id', addonId)
        .limit(1)
      if ((stillActive ?? []).length === 0) {
        for (const pkg of packagesForPlan(addon.plan_key, addon.bundle_keys)) {
          await admin
            .from('member_package_access')
            .delete()
            .eq('community_id', addon.community_id as string)
            .eq('profile_id', addon.profile_id as string)
            .eq('package', pkg)
        }
      }
    }

    try {
      const name = isAddonPlanKey(addon.plan_key) ? ADDON_NAMES[addon.plan_key] : addon.plan_key === BUNDLE_PLAN_KEY ? 'Cesta de conteúdos' : 'Plano'
      await admin.from('notifications').insert({
        profile_id: addon.profile_id,
        type: 'billing',
        title: `${name} cancelado`,
        body: 'Sua assinatura foi cancelada e não será cobrada de novo. O acesso foi encerrado agora, na hora. Que tal levar todos os conteúdos com o Círcula Premium? Escolhendo 6 meses ou 1 ano, ele sai ainda mais em conta. Veja em Planos.',
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
