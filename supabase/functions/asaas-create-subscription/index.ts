import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'

// =====================================================================
// FASE 16.2.4-B — Checkout de assinatura de COMUNIDADE (Split nativo 90/10)
// =====================================================================
// O ramo `subject='platform'` abaixo NÃO foi alterado (assinatura da
// Professional). A partir da 16.2.4-B, `subject='community'` passa a:
//   • resolver o preço SÓ de `community_billing_settings` (nunca do cliente);
//   • congelar preço/ciclo/split nas 8 colunas *_snapshot de `subscriptions`;
//   • criar a assinatura Asaas com `split` nativo p/ a carteira validada
//     da Professional (90% Professional / 10% Círcula no MVP);
//   • exigir membership ACTIVE do Member e conta Asaas conectada da dona;
//   • impedir 2 subscriptions Asaas para o mesmo (Member, comunidade)
//     via lock otimista.
// Nada aqui torna `resolve_split` executável por `authenticated` nem
// aceita walletId vindo do cliente.
// =====================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sentinela do lock otimista: `subscriptions.asaas_subscription_id` fica
// marcado com `__provisioning__:<ISO>` enquanto a criação da assinatura
// Asaas está em andamento. Nunca é um id Asaas real. O carimbo de tempo
// permite recuperar um lock preso por uma invocação que morreu antes de
// persistir o id (I-1).
const PROVISIONING = '__provisioning__'
// Além do tempo máximo de execução de uma Edge Function (Supabase: ~150s
// de wall clock). Passado isso, o lock é considerado órfão e pode ser
// assumido por uma nova invocação.
const PROVISIONING_STALE_MS = 5 * 60 * 1000

function provisioningStamp(): string {
  return `${PROVISIONING}:${new Date().toISOString()}`
}
function isProvisioning(v: unknown): v is string {
  return typeof v === 'string' && (v === PROVISIONING || v.startsWith(`${PROVISIONING}:`))
}
function isStaleProvisioning(v: string): boolean {
  const iso = v.startsWith(`${PROVISIONING}:`) ? v.slice(PROVISIONING.length + 1) : ''
  const ts = Date.parse(iso)
  // sem carimbo válido (formato antigo) -> tratar como órfão recuperável
  return Number.isNaN(ts) || Date.now() - ts > PROVISIONING_STALE_MS
}

// walletId(s) da(s) conta(s) emissora(s) do Círcula — nunca podem ser o
// destino do repasse da Professional. Mesmo secret usado por
// `connect-asaas-account`.
const CIRCULA_WALLET_IDS = (Deno.env.get('CIRCULA_WALLET_IDS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s.length > 0)

class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Admin = ReturnType<typeof createClient>

async function firstInvoiceUrl(asaasSubscriptionId: string): Promise<string | null> {
  try {
    const payments = await asaasFetch(`/payments?subscription=${asaasSubscriptionId}&limit=1`)
    return payments?.data?.[0]?.invoiceUrl ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Ramo community — todo o fluxo financeiro da assinatura de comunidade.
// Retorna sempre uma Response. Não toca no ramo platform.
// ---------------------------------------------------------------------
async function handleCommunitySubscription(
  admin: Admin,
  userId: string,
  communityId: string,
  profileFullName: string | null,
  buyerDocumentNumber: string,
): Promise<Response> {
  if (!UUID_RE.test(communityId)) {
    return jsonResponse(400, { error: 'community_id inválido.', code: 'INVALID_COMMUNITY_ID' })
  }

  // 1) comunidade + dona
  const { data: community, error: communityError } = await admin
    .from('communities')
    .select('id, owner_id, name')
    .eq('id', communityId)
    .maybeSingle()
  if (communityError) {
    console.error('asaas-create-subscription: falha ao buscar comunidade', communityError)
    return jsonResponse(500, { error: 'Erro ao verificar a comunidade.' })
  }
  if (!community) {
    return jsonResponse(404, { error: 'Comunidade não encontrada.', code: 'COMMUNITY_NOT_FOUND' })
  }

  // 2) o Member precisa ter a entrada APROVADA. 'active' (fluxo normal) ou
  //    'blocked' (billing bloqueou; pagar aqui é justamente o caminho de
  //    regularização). 'pending' NÃO pode pagar antes da aprovação.
  const { data: membership } = await admin
    .from('community_members')
    .select('status')
    .eq('community_id', communityId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (!membership || (membership.status !== 'active' && membership.status !== 'blocked')) {
    return jsonResponse(403, {
      error: 'Você precisa ter a entrada aprovada nesta comunidade antes de assinar.',
      code: 'NOT_ACTIVE_MEMBER',
    })
  }

  // 3) a assinatura de comunidade já existe (trigger create_community_trial)
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('subject', 'community')
    .eq('profile_id', userId)
    .eq('community_id', communityId)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!subscription) {
    return jsonResponse(404, {
      error: 'Não encontramos sua assinatura desta comunidade. Recarregue a página.',
      code: 'NO_SUBSCRIPTION',
    })
  }

  // 4) idempotência: assinatura Asaas real já vinculada -> devolve a fatura
  const existingAsaasId = subscription.asaas_subscription_id as string | null
  if (existingAsaasId && !isProvisioning(existingAsaasId)) {
    const invoiceUrl = await firstInvoiceUrl(existingAsaasId)
    return jsonResponse(200, {
      asaasCustomerId: subscription.asaas_customer_id,
      asaasSubscriptionId: existingAsaasId,
      invoiceUrl,
      reused: true,
    })
  }

  // 5) lock otimista. Adquire quando: (a) `asaas_subscription_id IS NULL`,
  //    ou (b) há um lock de provisioning ÓRFÃO (invocação anterior morreu —
  //    I-1). Um lock RECENTE -> outra invocação está criando agora -> 409.
  const takingOverStale = !!existingAsaasId && isStaleProvisioning(existingAsaasId)
  if (existingAsaasId && isProvisioning(existingAsaasId) && !takingOverStale) {
    return jsonResponse(409, {
      error: 'Sua assinatura está sendo criada. Aguarde alguns segundos e tente de novo.',
      code: 'PROVISIONING',
    })
  }

  const lockStamp = provisioningStamp()
  let acquire = admin
    .from('subscriptions')
    .update({ asaas_subscription_id: lockStamp })
    .eq('id', subscription.id)
  // CAS sobre o valor exato que lemos (NULL ou o lock órfão).
  acquire =
    existingAsaasId === null
      ? acquire.is('asaas_subscription_id', null)
      : acquire.eq('asaas_subscription_id', existingAsaasId)
  const { data: locked } = await acquire.select('id')
  if (!locked || locked.length === 0) {
    // corrida perdida para outra invocação concorrente
    const { data: fresh } = await admin
      .from('subscriptions')
      .select('asaas_subscription_id, asaas_customer_id')
      .eq('id', subscription.id)
      .maybeSingle()
    const freshId = fresh?.asaas_subscription_id as string | null
    if (freshId && !isProvisioning(freshId)) {
      const invoiceUrl = await firstInvoiceUrl(freshId)
      return jsonResponse(200, {
        asaasCustomerId: fresh?.asaas_customer_id,
        asaasSubscriptionId: freshId,
        invoiceUrl,
        reused: true,
      })
    }
    return jsonResponse(409, {
      error: 'Sua assinatura está sendo criada. Aguarde alguns segundos e tente de novo.',
      code: 'PROVISIONING',
    })
  }

  try {
    // 6) PREÇO — fonte única: community_billing_settings (nunca o cliente)
    const { data: priceRow } = await admin
      .from('community_billing_settings')
      .select('price_cents, billing_cycle, currency')
      .eq('community_id', communityId)
      .maybeSingle()
    if (!priceRow) {
      throw new HttpError(500, 'O preço desta comunidade não está configurado.', 'PRICE_NOT_SET')
    }
    const priceCents = Number(priceRow.price_cents)
    if (!Number.isInteger(priceCents) || priceCents < 1490) {
      throw new HttpError(422, 'O preço configurado para esta comunidade é inválido.', 'PRICE_BELOW_MIN')
    }
    const billingCycle = (priceRow.billing_cycle as string | null) ?? 'MONTHLY'
    const currency = (priceRow.currency as string | null) ?? 'BRL'

    // 7) SPLIT — resolvido no servidor. resolve_split lê a conta da dona.
    const { data: splitRows, error: splitError } = await admin.rpc('resolve_split', {
      p_community_id: communityId,
      p_amount_cents: priceCents,
    })
    if (splitError) {
      // no_data_found => nenhuma regra de split cadastrada
      const code = splitError.code === 'P0002' ? 'NO_SPLIT_RULE' : 'SPLIT_UNRESOLVED'
      throw new HttpError(500, 'Não foi possível resolver o rateio da assinatura.', code)
    }
    const split = Array.isArray(splitRows) ? splitRows[0] : splitRows
    if (!split) {
      throw new HttpError(500, 'Nenhuma regra de rateio configurada.', 'NO_SPLIT_RULE')
    }
    const circulaPercent = Number(split.circula_percent)
    const circulaAmountCents = Number(split.circula_amount_cents)
    const professionalAmountCents = Number(split.professional_amount_cents)
    const splitModel = split.split_model as 'native' | 'ledger'
    const walletId = (split.professional_wallet_id as string | null) ?? null

    // 8) política MVP: só assinatura com Split NATIVO. Sem conta conectada
    //    da dona -> bloqueia (nada de dinheiro sem destino de repasse).
    if (splitModel !== 'native' || !walletId) {
      throw new HttpError(
        409,
        'Esta comunidade ainda não está pronta para receber assinaturas: a responsável precisa concluir a conexão da conta de recebimento.',
        'OWNER_NOT_CONNECTED',
      )
    }

    // 9) reconfirmação defensiva da conta da dona (resolve_split não
    //    checa disconnected_at) + walletId nunca pode ser a emissora.
    const { data: ownerAccount } = await admin
      .from('professional_billing_accounts')
      .select('asaas_wallet_id, payout_method, verified_at, disconnected_at')
      .eq('profile_id', community.owner_id)
      .maybeSingle()
    const accountOk =
      !!ownerAccount &&
      ownerAccount.verified_at != null &&
      ownerAccount.disconnected_at == null &&
      ownerAccount.payout_method === 'asaas_split' &&
      ownerAccount.asaas_wallet_id === walletId
    if (!accountOk) {
      throw new HttpError(
        409,
        'A conta de recebimento da responsável não está ativa.',
        'OWNER_NOT_CONNECTED',
      )
    }
    if (CIRCULA_WALLET_IDS.includes(walletId.toLowerCase())) {
      throw new HttpError(422, 'Carteira de destino inválida para o repasse.', 'ISSUER_WALLET')
    }

    // 10) customer Asaas do Member (alinhado com asaas-create-product-order:
    //     asaas_customers primeiro, cria e faz upsert se necessário)
    let asaasCustomerId = (subscription.asaas_customer_id as string | null) ?? null
    if (!asaasCustomerId) {
      const { data: mapped } = await admin
        .from('asaas_customers')
        .select('asaas_customer_id')
        .eq('profile_id', userId)
        .maybeSingle()
      asaasCustomerId = mapped?.asaas_customer_id ?? null
    }
    if (!asaasCustomerId) {
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: profileFullName ?? 'Participante Círcula',
          cpfCnpj: buyerDocumentNumber,
          email: authUser.user?.email,
          externalReference: userId,
        }),
      })
      asaasCustomerId = customer.id as string
    }
    await admin
      .from('asaas_customers')
      .upsert({ profile_id: userId, asaas_customer_id: asaasCustomerId }, { onConflict: 'profile_id' })

    // 11) assinatura Asaas com Split nativo (percentualValue sobre o net).
    //     I-1: a externalReference é SEMPRE `subscription.id` (server-side,
    //     nunca do cliente). Antes de criar, procura por essa
    //     externalReference uma assinatura Asaas já existente — se uma
    //     invocação anterior a criou mas morreu antes de persistir o id,
    //     ADOTA a existente em vez de criar uma segunda.
    const nextDueDateSource =
      new Date(subscription.trial_ends_at as string) > new Date()
        ? (subscription.trial_ends_at as string)
        : new Date().toISOString()
    const nextDueDate = nextDueDateSource.slice(0, 10)
    const professionalPercent = Math.round((100 - circulaPercent) * 100) / 100
    const externalReference = subscription.id as string

    let asaasSubscription: { id: string }
    let existingByRef: { data?: Array<{ id?: unknown; value?: unknown }> } | null = null
    try {
      existingByRef = await asaasFetch(
        `/subscriptions?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
      )
    } catch (lookupErr) {
      // Só é obrigatório encontrar quando estamos ASSUMINDO um lock órfão
      // (aí um POST cego criaria uma 2ª assinatura). No caminho normal
      // (lock recém-adquirido de NULL) nunca há assinatura pré-existente.
      if (takingOverStale) {
        throw new HttpError(
          502,
          'Não foi possível verificar a assinatura existente. Tente novamente em instantes.',
          'ASAAS_LOOKUP_FAILED',
        )
      }
      console.warn('asaas-create-subscription: GET /subscriptions?externalReference falhou', {
        subId: externalReference,
        message: (lookupErr as Error).message,
      })
    }
    const adopted = existingByRef?.data?.[0]
    if (adopted && typeof adopted.id === 'string') {
      asaasSubscription = { id: adopted.id }
      if (typeof adopted.value === 'number' && Math.round(adopted.value * 100) !== priceCents) {
        console.warn('asaas-create-subscription: assinatura Asaas adotada com value divergente', {
          subId: externalReference,
          adoptedValueCents: Math.round(adopted.value * 100),
          priceCents,
        })
      }
    } else {
      asaasSubscription = await asaasFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'UNDEFINED',
          value: priceCents / 100,
          cycle: billingCycle,
          nextDueDate,
          description: `Círcula — ${community.name}`,
          externalReference,
          split: [{ walletId, percentualValue: professionalPercent }],
        }),
      })
    }

    // 12) persiste IDs + SNAPSHOT num único UPDATE (troca o lock pelo id real)
    const { error: persistError } = await admin
      .from('subscriptions')
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscription.id,
        price_cents_snapshot: priceCents,
        billing_cycle_snapshot: billingCycle,
        currency_snapshot: currency,
        split_model_snapshot: splitModel,
        circula_percent_snapshot: circulaPercent,
        circula_amount_cents_snapshot: circulaAmountCents,
        professional_amount_cents_snapshot: professionalAmountCents,
        professional_wallet_id_snapshot: walletId,
      })
      .eq('id', subscription.id)
    if (persistError) {
      // a assinatura Asaas JÁ existe — garante ao menos o id para o webhook
      await admin
        .from('subscriptions')
        .update({
          asaas_subscription_id: asaasSubscription.id,
          asaas_customer_id: asaasCustomerId,
        })
        .eq('id', subscription.id)
      console.error('asaas-create-subscription: falha ao gravar snapshot', persistError)
      throw new HttpError(
        500,
        'Assinatura criada, mas os dados não puderam ser gravados por completo. Recarregue a página.',
        'PERSIST_FAILED',
      )
    }

    const invoiceUrl = await firstInvoiceUrl(asaasSubscription.id)
    return jsonResponse(200, {
      asaasCustomerId,
      asaasSubscriptionId: asaasSubscription.id,
      invoiceUrl,
      reused: false,
    })
  } catch (err) {
    // libera o lock SÓ se ainda for exatamente o nosso carimbo
    await admin
      .from('subscriptions')
      .update({ asaas_subscription_id: null })
      .eq('id', subscription.id)
      .eq('asaas_subscription_id', lockStamp)

    if (err instanceof HttpError) {
      return jsonResponse(err.status, { error: err.message, code: err.code })
    }
    console.error('asaas-create-subscription (community): erro inesperado', (err as Error).message)
    return jsonResponse(502, {
      error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.',
      code: 'ASAAS_FAILED',
    })
  }
}

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

    // FASE 16.2.4-B — assinatura de comunidade tem fluxo próprio
    // (preço server-side + snapshot + Split nativo). O ramo platform
    // abaixo permanece inalterado.
    if (subject === 'community') {
      return await handleCommunitySubscription(
        admin,
        user.id,
        typeof communityId === 'string' ? communityId : '',
        profile?.full_name ?? null,
        billingData.document_number,
      )
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
