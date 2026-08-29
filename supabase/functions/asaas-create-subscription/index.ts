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

    const { subject, community_id: communityId, plan_code: planCode } = await req.json()

    if (subject !== 'platform' && subject !== 'community') {
      return new Response(JSON.stringify({ error: 'subject inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: billingData } = await admin
      .from('billing_customer_data')
      .select('document_type, document_number')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!billingData) {
      return new Response(
        JSON.stringify({ error: 'Cadastre CPF/CNPJ antes de assinar.', code: 'MISSING_BILLING_DATA' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('asaas-create-subscription: falha ao buscar profile', profileError)
      return new Response(JSON.stringify({ error: 'Erro ao buscar dados do perfil.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: plan } = await admin
      .from('billing_plans')
      .select('id, subject, price_cents, billing_cycle')
      .eq('code', planCode)
      .eq('is_active', true)
      .maybeSingle()

    if (!plan || plan.subject !== subject) {
      return new Response(JSON.stringify({ error: 'Plano inválido para este tipo de assinatura.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subscriptionQuery = admin
      .from('subscriptions')
      .select('*')
      .eq('subject', subject)
      .eq('profile_id', user.id)
      .neq('status', 'canceled')

    subscriptionQuery = communityId
      ? subscriptionQuery.eq('community_id', communityId)
      : subscriptionQuery.is('community_id', null)

    const { data: subscription } = await subscriptionQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Nenhuma assinatura em trial encontrada para vincular.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let asaasCustomerId = subscription.asaas_customer_id as string | null

    if (!asaasCustomerId) {
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)

      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: profile?.full_name ?? 'Participante Círcula',
          cpfCnpj: billingData.document_number,
          email: authUser.user?.email,
          externalReference: user.id,
        }),
      })

      asaasCustomerId = customer.id
    }

    const nextDueDateSource =
      new Date(subscription.trial_ends_at) > new Date() ? subscription.trial_ends_at : new Date().toISOString()
    const nextDueDate = nextDueDateSource.slice(0, 10)

    const asaasSubscription = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        value: plan.price_cents / 100,
        cycle: plan.billing_cycle,
        nextDueDate,
        description: `Círcula — ${planCode}`,
        externalReference: subscription.id,
      }),
    })

    await admin
      .from('subscriptions')
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscription.id,
        plan_id: plan.id,
      })
      .eq('id', subscription.id)

    let invoiceUrl: string | null = null
    try {
      const payments = await asaasFetch(`/payments?subscription=${asaasSubscription.id}&limit=1`)
      invoiceUrl = payments?.data?.[0]?.invoiceUrl ?? null
    } catch {
      invoiceUrl = null
    }

    return new Response(JSON.stringify({ asaasCustomerId, asaasSubscriptionId: asaasSubscription.id, invoiceUrl }), {
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
