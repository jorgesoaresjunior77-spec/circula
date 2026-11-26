import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import {
  ADDON_NAMES,
  addonPriceCents,
  applyReferralDiscount,
  isAddonPlanKey,
  isAsaasCycle,
  isValidInstallments,
  maxInstallments,
} from '../_shared/addonPlans.ts'

// =====================================================================
// Assinatura AVULSA de um conteúdo (revista, receitas, e-books, Help Nutri,
// respiração, playlist, wellness) ou do Círcula Premium.
//   • o preço vem SÓ de _shared/addonPlans.ts (nunca do navegador);
//   • exige membership aprovada na comunidade;
//   • cria o customer/assinatura no Asaas (Sandbox enquanto a chave for
//     de teste: asaasFetch recusa chave de produção) e grava a linha em
//     addon_subscriptions como 'pending';
//   • o webhook (asaas-webhook) ativa a linha e libera o pacote quando o
//     pagamento é confirmado.
// Sem split nativo por enquanto: o valor cai na conta da plataforma, como
// COMMUNITY_SPLIT_MODE=off nas assinaturas de comunidade.
// Ainda NÃO publicada: depende da liberação do usuário (ver página de Planos).
// =====================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ADDON_REF_PREFIX = 'addon:'

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
    const { plan_key: planKey, billing_cycle: cycle, community_id: communityId, installments: rawInstallments } = body as Record<string, unknown>
    if (!isAddonPlanKey(planKey)) return json(400, { error: 'Plano inválido.', code: 'INVALID_PLAN' })
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

    // preço editado pelo Master (se houver) vale no lugar do catálogo; nunca vem do navegador
    const { data: override } = await admin.from('product_price_overrides').select('monthly_cents').eq('plan_key', planKey).maybeSingle()
    let priceCents = addonPriceCents(planKey, cycle, (override?.monthly_cents as number | undefined) ?? null)

    // Parcelas: só semestral (até 6x) e anual (até 12x), no cartão; o padrão é pagar de uma vez.
    const installments = rawInstallments === undefined || rawInstallments === null ? 1 : rawInstallments
    if (!isValidInstallments(cycle, priceCents, installments)) {
      return json(400, { error: `Parcelamento inválido para este plano (até ${maxInstallments(cycle)}x).`, code: 'INVALID_INSTALLMENTS' })
    }

    // Já existe uma contratação viva deste plano?
    //  • ativa: não cobra de novo;
    //  • pendente/atrasada com o MESMO ciclo, valor e parcelas: devolve a mesma fatura (não duplica);
    //  • pendente/atrasada com outro ciclo ou outro valor (ex.: assinatura antiga de R$ 59,90 mensal e
    //    agora a pessoa escolheu o anual): cancela a antiga no Asaas e cria a nova com o valor certo.
    //    Antes, a fatura antiga era devolvida e a pessoa pagava o valor errado.
    const { data: existing } = await admin
      .from('addon_subscriptions')
      .select('id, asaas_subscription_id, asaas_installment_id, status, billing_cycle, price_cents, installment_count')
      .eq('profile_id', user.id)
      .eq('community_id', communityId)
      .eq('plan_key', planKey)
      .neq('status', 'canceled')
      .maybeSingle()
    if (existing) {
      if (existing.status === 'active') {
        return json(409, { error: 'Você já tem este plano ativo.', code: 'ALREADY_ACTIVE' })
      }
      const same =
        existing.billing_cycle === cycle &&
        // (o valor pode já ter o desconto da indicação, aplicado uma vez só)
        (existing.price_cents === priceCents || (planKey === 'premium' && existing.price_cents === applyReferralDiscount(priceCents))) &&
        (existing.installment_count ?? 1) === installments
      if (same && (existing.asaas_subscription_id || existing.asaas_installment_id)) {
        const query = existing.asaas_installment_id
          ? `/payments?installment=${existing.asaas_installment_id}&limit=1`
          : `/payments?subscription=${existing.asaas_subscription_id}&limit=1`
        const pay = await asaasFetch(query).catch(() => null)
        return json(200, {
          asaasSubscriptionId: existing.asaas_subscription_id ?? null,
          invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null,
          reused: true,
        })
      }
      try {
        if (existing.asaas_installment_id) await asaasFetch(`/installments/${existing.asaas_installment_id}`, { method: 'DELETE' })
        else if (existing.asaas_subscription_id) await asaasFetch(`/subscriptions/${existing.asaas_subscription_id}`, { method: 'DELETE' })
      } catch (err) {
        console.error('asaas-create-addon-subscription: não cancelou a cobrança antiga', existing.id, (err as Error).message)
        return json(502, { error: 'Não foi possível trocar o plano agora. Tente novamente em instantes.', code: 'ASAAS_FAILED' })
      }
      await admin
        .from('addon_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }

    // Indicação Premium: quem chegou por convite de quem TEM o Premium paga 10% a menos
    // no Premium dela (uma vez). Confere no servidor: indicação existe, não foi usada
    // e quem indicou ainda tem o Premium agora.
    let referralInvitee: string | null = null
    if (planKey === 'premium') {
      const { data: ref } = await admin
        .from('referrals')
        .select('inviter_id, discount_used_at')
        .eq('invitee_id', user.id)
        .eq('community_id', communityId)
        .maybeSingle()
      if (ref && !ref.discount_used_at) {
        const { data: inviterPremium } = await admin
          .from('member_package_access')
          .select('package')
          .eq('community_id', communityId)
          .eq('profile_id', ref.inviter_id)
          .eq('package', 'premium')
          .maybeSingle()
        if (inviterPremium) {
          priceCents = applyReferralDiscount(priceCents)
          referralInvitee = user.id
        }
      }
    }

    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

    // customer Asaas do membro (reaproveita o mapeamento já existente)
    let customerId: string | null = null
    const { data: mapped } = await admin
      .from('asaas_customers')
      .select('asaas_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle()
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
      await admin
        .from('asaas_customers')
        .upsert({ profile_id: user.id, asaas_customer_id: customerId }, { onConflict: 'profile_id' })
    }

    // Linha 'pending' primeiro: o id dela vira a externalReference.
    const { data: row, error: rowError } = await admin
      .from('addon_subscriptions')
      .insert({
        profile_id: user.id,
        community_id: communityId,
        plan_key: planKey,
        billing_cycle: cycle,
        price_cents: priceCents,
        installment_count: installments,
        asaas_customer_id: customerId,
      })
      .select('id')
      .single()
    if (rowError || !row) {
      console.error('asaas-create-addon-subscription: falha ao gravar', rowError)
      return json(500, { error: 'Não foi possível iniciar a assinatura agora.' })
    }

    // Parcelado no cartão: UMA cobrança com o valor total (6 ou 12 meses), dividida em parcelas.
    // Não renova sozinha: ao fim da vigência a pessoa contrata de novo.
    if (installments > 1) {
      try {
        const first = await asaasFetch('/payments', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: 'CREDIT_CARD',
            installmentCount: installments,
            totalValue: priceCents / 100,
            dueDate: new Date().toISOString().slice(0, 10),
            description: `Círcula — ${ADDON_NAMES[planKey]} (${cycle === 'YEARLY' ? '12 meses' : '6 meses'}, ${installments}x no cartão)`,
            externalReference: `${ADDON_REF_PREFIX}${row.id}`,
          }),
        })
        await admin
          .from('addon_subscriptions')
          .update({ asaas_installment_id: (first.installment as string | undefined) ?? null, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (referralInvitee) {
          await admin.from('referrals').update({ discount_used_at: new Date().toISOString() }).eq('invitee_id', referralInvitee)
        }
        return json(200, { asaasSubscriptionId: null, invoiceUrl: (first.invoiceUrl as string | undefined) ?? null, reused: false })
      } catch (err) {
        await admin.from('addon_subscriptions').delete().eq('id', row.id).is('asaas_installment_id', null)
        console.error('asaas-create-addon-subscription: parcelamento falhou', (err as Error).message)
        return json(502, { error: 'Não foi possível criar a cobrança parcelada agora. Tente novamente em instantes.', code: 'ASAAS_FAILED' })
      }
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
          description: `Círcula — ${ADDON_NAMES[planKey]}`,
          externalReference: `${ADDON_REF_PREFIX}${row.id}`,
        }),
      })
      await admin
        .from('addon_subscriptions')
        .update({ asaas_subscription_id: sub.id, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (referralInvitee) {
        await admin.from('referrals').update({ discount_used_at: new Date().toISOString() }).eq('invitee_id', referralInvitee)
      }
      const pay = await asaasFetch(`/payments?subscription=${sub.id}&limit=1`).catch(() => null)
      return json(200, {
        asaasSubscriptionId: sub.id,
        invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null,
        reused: false,
      })
    } catch (err) {
      // não deixa uma linha 'pending' órfã sem assinatura no Asaas
      await admin.from('addon_subscriptions').delete().eq('id', row.id).is('asaas_subscription_id', null)
      console.error('asaas-create-addon-subscription: Asaas falhou', (err as Error).message)
      return json(502, {
        error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.',
        code: 'ASAAS_FAILED',
      })
    }
  } catch (error) {
    console.error('asaas-create-addon-subscription: erro inesperado', (error as Error).message)
    return json(500, { error: 'Erro inesperado.' })
  }
})
