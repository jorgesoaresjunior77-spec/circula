import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import {
  ADDON_NAMES,
  BUNDLE_PLAN_KEY,
  addonPriceCents,
  bundlePriceCents,
  isAsaasCycle,
  sanitizeBundle,
} from '../_shared/addonPlans.ts'
import type { AddonPlanKey } from '../_shared/addonPlans.ts'

// =====================================================================
// CESTA: a membro escolhe vários conteúdos avulsos e assina todos juntos, numa cobrança só.
//   • o preço é a soma do preço de cada conteúdo no ciclo, calculado SÓ aqui (nunca vem do navegador);
//   • o Premium não entra na cesta (é um plano à parte);
//   • não deixa assinar de novo um conteúdo que a membro já tem;
//   • grava UMA linha em addon_subscriptions (plan_key = 'cesta', bundle_keys = os conteúdos) e uma
//     assinatura no Asaas; o webhook libera todos os conteúdos quando o pagamento é confirmado.
// =====================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ADDON_REF_PREFIX = 'addon:'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return json(401, { error: 'Sem sessão ativa.' })

    const body = await req.json().catch(() => ({}))
    const { plan_keys: rawKeys, billing_cycle: cycle, community_id: communityId } = body as Record<string, unknown>
    const keys = sanitizeBundle(rawKeys)
    if (keys.length < 2) return json(400, { error: 'Escolha pelo menos 2 conteúdos para a cesta.', code: 'INVALID_BUNDLE' })
    if (!isAsaasCycle(cycle)) return json(400, { error: 'Ciclo inválido.', code: 'INVALID_CYCLE' })
    if (typeof communityId !== 'string' || !UUID_RE.test(communityId)) {
      return json(400, { error: 'community_id inválido.', code: 'INVALID_COMMUNITY_ID' })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: membership } = await admin
      .from('community_members')
      .select('status')
      .eq('community_id', communityId)
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!membership || membership.status !== 'active') {
      return json(403, { error: 'Você precisa ter a entrada aprovada nesta comunidade.', code: 'NOT_ACTIVE_MEMBER' })
    }

    const { data: billing } = await admin
      .from('billing_customer_data')
      .select('document_number')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!billing) return json(400, { error: 'Cadastre CPF/CNPJ antes de assinar.', code: 'MISSING_BILLING_DATA' })

    // Já tem algum desses conteúdos (ou o Premium)? Não cobra em dobro.
    const { data: owned } = await admin
      .from('member_package_access')
      .select('package')
      .eq('community_id', communityId)
      .eq('profile_id', user.id)
    const ownedSet = new Set(((owned ?? []) as { package: string }[]).map((r) => r.package))
    if (ownedSet.has('premium')) return json(409, { error: 'Você já tem o Círcula Premium, que inclui tudo.', code: 'ALREADY_PREMIUM' })
    const dup = keys.filter((k) => ownedSet.has(k))
    if (dup.length > 0) {
      return json(409, {
        error: `Você já tem: ${dup.map((k) => ADDON_NAMES[k]).join(', ')}. Tire da cesta e tente de novo.`,
        code: 'ALREADY_OWNED',
      })
    }

    // preços editados pelo Master (se houver) valem no lugar do catálogo
    const { data: overrides } = await admin.from('product_price_overrides').select('plan_key, monthly_cents').in('plan_key', keys)
    const overrideMap: Partial<Record<AddonPlanKey, number>> = {}
    for (const o of (overrides ?? []) as { plan_key: AddonPlanKey; monthly_cents: number }[]) overrideMap[o.plan_key] = o.monthly_cents
    const priceCents = bundlePriceCents(keys, cycle, overrideMap)

    // Uma cesta viva por vez. Mesma cesta, mesmo ciclo e valor ainda não paga: devolve a mesma fatura.
    // Cesta diferente (outro ciclo, outros conteúdos ou outro valor) ainda não paga: cancela a antiga e cria a nova,
    // para nunca cobrar o valor velho. Cesta já ativa: não cobra de novo.
    const { data: existing } = await admin
      .from('addon_subscriptions')
      .select('id, asaas_subscription_id, status, billing_cycle, price_cents, bundle_keys')
      .eq('profile_id', user.id)
      .eq('community_id', communityId)
      .eq('plan_key', BUNDLE_PLAN_KEY)
      .neq('status', 'canceled')
      .maybeSingle()
    if (existing) {
      if (existing.status === 'active') {
        return json(409, { error: 'Você já tem uma cesta ativa. Cancele um conteúdo dela ou fale com o suporte para trocar.', code: 'BUNDLE_ACTIVE' })
      }
      const sameKeys = [...((existing.bundle_keys as string[] | null) ?? [])].sort().join(',') === [...keys].sort().join(',')
      if (sameKeys && existing.billing_cycle === cycle && existing.price_cents === priceCents && existing.asaas_subscription_id) {
        const pay = await asaasFetch(`/payments?subscription=${existing.asaas_subscription_id}&limit=1`).catch(() => null)
        return json(200, { asaasSubscriptionId: existing.asaas_subscription_id, invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null, reused: true })
      }
      try {
        if (existing.asaas_subscription_id) await asaasFetch(`/subscriptions/${existing.asaas_subscription_id}`, { method: 'DELETE' })
      } catch (err) {
        console.error('asaas-create-cart-subscription: não cancelou a cesta antiga', existing.id, (err as Error).message)
        return json(502, { error: 'Não foi possível trocar a cesta agora. Tente novamente em instantes.', code: 'ASAAS_FAILED' })
      }
      await admin.from('addon_subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', existing.id)
    }
    // a cesta nunca custa mais que o Premium no mesmo ciclo: nesse caso, o Premium é a melhor escolha
    const premiumCents = addonPriceCents('premium', cycle, null)
    if (priceCents >= premiumCents) {
      return json(409, { error: 'Essa cesta custa o mesmo que o Círcula Premium (ou mais). No Premium você leva tudo.', code: 'USE_PREMIUM' })
    }

    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    let customerId: string | null = null
    const { data: mapped } = await admin.from('asaas_customers').select('asaas_customer_id').eq('profile_id', user.id).maybeSingle()
    customerId = mapped?.asaas_customer_id ?? null
    if (!customerId) {
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)
      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: profile?.full_name ?? 'Participante Círcula',
          cpfCnpj: billing.document_number,
          email: authUser.user?.email,
          externalReference: user.id,
        }),
      })
      customerId = customer.id as string
      await admin.from('asaas_customers').upsert({ profile_id: user.id, asaas_customer_id: customerId }, { onConflict: 'profile_id' })
    }

    const { data: row, error: rowError } = await admin
      .from('addon_subscriptions')
      .insert({
        profile_id: user.id,
        community_id: communityId,
        plan_key: BUNDLE_PLAN_KEY,
        bundle_keys: keys,
        billing_cycle: cycle,
        price_cents: priceCents,
        asaas_customer_id: customerId,
      })
      .select('id')
      .single()
    if (rowError || !row) {
      console.error('asaas-create-cart-subscription: falha ao gravar', rowError)
      return json(500, { error: 'Não foi possível iniciar a assinatura agora.' })
    }

    try {
      const sub = await asaasFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED',
          value: priceCents / 100,
          cycle,
          nextDueDate: new Date().toISOString().slice(0, 10),
          description: `Círcula — ${keys.map((k) => ADDON_NAMES[k]).join(', ')}`.slice(0, 500),
          externalReference: `${ADDON_REF_PREFIX}${row.id}`,
        }),
      })
      await admin.from('addon_subscriptions').update({ asaas_subscription_id: sub.id, updated_at: new Date().toISOString() }).eq('id', row.id)
      const pay = await asaasFetch(`/payments?subscription=${sub.id}&limit=1`).catch(() => null)
      return json(200, { asaasSubscriptionId: sub.id, invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null, reused: false })
    } catch (err) {
      await admin.from('addon_subscriptions').delete().eq('id', row.id).is('asaas_subscription_id', null)
      console.error('asaas-create-cart-subscription: Asaas falhou', (err as Error).message)
      return json(502, { error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.', code: 'ASAAS_FAILED' })
    }
  } catch (error) {
    console.error('asaas-create-cart-subscription: erro inesperado', (error as Error).message)
    return json(500, { error: 'Erro inesperado.' })
  }
})
