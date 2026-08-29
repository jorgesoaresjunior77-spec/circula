import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { addCycleMonths } from '../_shared/asaas.ts'

const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE'])
const REOPENABLE_STATUSES = new Set(['trial', 'active', 'past_due'])

// --- Etapa 4.3: pagamento avulso de produto (externalReference = product_order:<order_id>) ---
const PRODUCT_ORDER_PREFIX = 'product_order:'
const DELETED_EVENTS = new Set(['PAYMENT_DELETED'])
const REFUND_EVENTS = new Set(['PAYMENT_REFUNDED'])
const CHARGEBACK_EVENTS = new Set(['PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK'])
// estados de product_orders.financial_status a partir dos quais ainda se pode avancar
const PRODUCT_ORDER_ADVANCEABLE = ['pending', 'confirmed', 'overdue']

type AsaasPayment = {
  id: string
  subscription?: string
  status: string
  dueDate: string
  value: number
  netValue?: number
  billingType?: string
  invoiceUrl?: string
  externalReference?: string
}

type Admin = ReturnType<typeof createClient>

// Processa eventos Asaas cujo externalReference e product_order:<order_id>.
// Nunca toca em subscriptions / payment_charges / billing_plans. Usa somente
// os snapshots ja congelados em product_orders (item 11).
async function handleProductOrderEvent(
  admin: Admin,
  event: string,
  payment: AsaasPayment,
  orderId: string,
) {
  const { data: order, error: orderError } = await admin
    .from('product_orders')
    .select(
      'id, product_id, community_id, buyer_profile_id, seller_id, amount_total_cents, ' +
        'split_model_snapshot, circula_amount_cents_snapshot, professional_amount_cents_snapshot, ' +
        'product_type_snapshot, financial_status, status, asaas_payment_id',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    console.error('asaas-webhook: falha ao buscar product_order', orderId, orderError)
    throw orderError
  }

  if (!order) {
    console.error('asaas-webhook: product_order inexistente para externalReference', orderId)
    return
  }

  // Pagamento orfao: pedido ja vinculado a outro payment.id (decisao 8).
  if (order.asaas_payment_id && order.asaas_payment_id !== payment.id) {
    console.error('asaas-webhook: pagamento orfao ignorado', {
      orderId,
      esperado: order.asaas_payment_id,
      recebido: payment.id,
    })
    return
  }

  const nowIso = new Date().toISOString()
  const valueCents = Math.round(payment.value * 100)
  const netCents = typeof payment.netValue === 'number' ? Math.round(payment.netValue * 100) : null

  // ---- pagamento confirmado / recebido -> concede acesso (decisoes 5 e 10) ----
  if (CONFIRMED_EVENTS.has(event)) {
    if (valueCents !== order.amount_total_cents) {
      console.error('asaas-webhook: divergencia de valor no product_order (decisao 7)', {
        orderId,
        esperado: order.amount_total_cents,
        recebido: valueCents,
      })
      return
    }

    const isReceived = event === 'PAYMENT_RECEIVED'
    const orderUpdate: Record<string, unknown> = {
      financial_status: isReceived ? 'received' : 'confirmed',
      status: 'completed',
      canceled_at: null,
    }
    if (isReceived) orderUpdate.paid_at = nowIso
    if (netCents !== null) {
      orderUpdate.asaas_net_value_cents = netCents
      orderUpdate.asaas_fee_cents = Math.max(0, order.amount_total_cents - netCents)
    }
    if (!order.asaas_payment_id) orderUpdate.asaas_payment_id = payment.id
    if (order.product_type_snapshot === 'physical') orderUpdate.fulfillment_status = 'pending'

    const { error: updError } = await admin
      .from('product_orders')
      .update(orderUpdate)
      .eq('id', order.id)
      .in('financial_status', PRODUCT_ORDER_ADVANCEABLE)

    if (updError) {
      console.error('asaas-webhook: falha ao atualizar product_order (confirmado)', order.id, updError)
      throw updError
    }

    // product_entitlements: ON CONFLICT DO NOTHING (item 10). Um 23505 no indice
    // parcial (product_id, profile_id) significa acesso ativo ja existente.
    const { error: entError } = await admin.from('product_entitlements').upsert(
      {
        order_id: order.id,
        product_id: order.product_id,
        profile_id: order.buyer_profile_id,
        community_id: order.community_id,
        source: 'purchase',
      },
      { onConflict: 'order_id', ignoreDuplicates: true },
    )
    if (entError && entError.code !== '23505') {
      console.error('asaas-webhook: falha ao criar product_entitlement', order.id, entError)
      throw entError
    }

    // product_payouts (sale) — valores efetivos do fluxo, sem recalcular o split (decisoes 2 e 11).
    // native: taxa Asaas absorvida pela Circula -> circula_fee = circula_snapshot - asaas_fee; status 'paid'.
    // ledger: snapshots congelados preservados; taxa Asaas registrada a parte; status 'pending'.
    const asaasFeeCents =
      netCents === null
        ? 0
        : order.split_model_snapshot === 'native'
          ? Math.max(0, order.amount_total_cents - order.professional_amount_cents_snapshot - netCents)
          : Math.max(0, order.amount_total_cents - netCents)

    const circulaFeeCents =
      order.split_model_snapshot === 'native'
        ? Math.max(0, order.circula_amount_cents_snapshot - asaasFeeCents)
        : order.circula_amount_cents_snapshot

    const { error: payoutError } = await admin.from('product_payouts').upsert(
      {
        order_id: order.id,
        community_id: order.community_id,
        professional_id: order.seller_id,
        kind: 'sale',
        split_model: order.split_model_snapshot,
        gross_amount_cents: order.amount_total_cents,
        asaas_fee_cents: asaasFeeCents,
        circula_fee_cents: circulaFeeCents,
        net_amount_cents: order.professional_amount_cents_snapshot,
        status: order.split_model_snapshot === 'native' ? 'paid' : 'pending',
      },
      { onConflict: 'order_id,kind', ignoreDuplicates: true },
    )
    if (payoutError && payoutError.code !== '23505') {
      console.error('asaas-webhook: falha ao criar product_payout (sale)', order.id, payoutError)
      throw payoutError
    }

    return
  }

  // ---- pagamento vencido -> pedido expira, sem acesso ----
  if (OVERDUE_EVENTS.has(event)) {
    const { error } = await admin
      .from('product_orders')
      .update({ financial_status: 'overdue', status: 'expired', canceled_at: nowIso })
      .eq('id', order.id)
      .in('financial_status', PRODUCT_ORDER_ADVANCEABLE)
    if (error) {
      console.error('asaas-webhook: falha ao expirar product_order', order.id, error)
      throw error
    }
    return
  }

  // ---- pagamento removido antes de pago -> pedido cancelado ----
  if (DELETED_EVENTS.has(event)) {
    const { error } = await admin
      .from('product_orders')
      .update({ status: 'canceled', canceled_at: nowIso })
      .eq('id', order.id)
      .in('financial_status', PRODUCT_ORDER_ADVANCEABLE)
    if (error) {
      console.error('asaas-webhook: falha ao cancelar product_order', order.id, error)
      throw error
    }
    return
  }

  // ---- reembolso / chargeback -> revoga acesso + reversal (decisoes 3 e 4) ----
  if (REFUND_EVENTS.has(event) || CHARGEBACK_EVENTS.has(event)) {
    const isChargeback = CHARGEBACK_EVENTS.has(event)
    const newFinancial = isChargeback ? 'chargeback' : 'refunded'
    const revokeReason = isChargeback ? 'chargeback' : 'refund'

    const { error: ordErr } = await admin
      .from('product_orders')
      .update({ financial_status: newFinancial, status: 'refunded', refunded_at: nowIso })
      .eq('id', order.id)
    if (ordErr) {
      console.error('asaas-webhook: falha ao marcar product_order reembolsado', order.id, ordErr)
      throw ordErr
    }

    const { error: revErr } = await admin
      .from('product_entitlements')
      .update({ revoked_at: nowIso, revoke_reason: revokeReason })
      .eq('order_id', order.id)
      .is('revoked_at', null)
    if (revErr) {
      console.error('asaas-webhook: falha ao revogar product_entitlement', order.id, revErr)
      throw revErr
    }

    // reversal espelha a linha de venda; fallback nos snapshots congelados (relatorio item 4 / 12).
    const { data: salePayout } = await admin
      .from('product_payouts')
      .select('split_model, gross_amount_cents, asaas_fee_cents, circula_fee_cents, net_amount_cents')
      .eq('order_id', order.id)
      .eq('kind', 'sale')
      .maybeSingle()

    const { error: revPayoutErr } = await admin.from('product_payouts').upsert(
      {
        order_id: order.id,
        community_id: order.community_id,
        professional_id: order.seller_id,
        kind: 'reversal',
        split_model: salePayout?.split_model ?? order.split_model_snapshot,
        gross_amount_cents: salePayout?.gross_amount_cents ?? order.amount_total_cents,
        asaas_fee_cents: salePayout?.asaas_fee_cents ?? 0,
        circula_fee_cents: salePayout?.circula_fee_cents ?? order.circula_amount_cents_snapshot,
        net_amount_cents: salePayout?.net_amount_cents ?? order.professional_amount_cents_snapshot,
        status: 'reversed',
        reversed_at: nowIso,
      },
      { onConflict: 'order_id,kind', ignoreDuplicates: true },
    )
    if (revPayoutErr && revPayoutErr.code !== '23505') {
      console.error('asaas-webhook: falha ao criar product_payout (reversal)', order.id, revPayoutErr)
      throw revPayoutErr
    }

    return
  }

  console.log('asaas-webhook: evento de produto sem tratamento, ignorado', event, order.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const receivedToken = req.headers.get('asaas-access-token') ?? ''

  if (!WEBHOOK_TOKEN || receivedToken !== WEBHOOK_TOKEN) {
    return new Response(JSON.stringify({ error: 'Token de webhook inválido.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.json()
    const event = payload.event as string | undefined
    const payment = payload.payment as AsaasPayment | undefined

    if (!event || !payment) {
      return new Response(JSON.stringify({ error: 'Payload sem event/payment.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const eventId = (payload.id as string | undefined) ?? `${payment.id}:${event}`

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { error: insertEventError } = await admin
      .from('webhook_events')
      .insert({ asaas_event_id: eventId, event_type: event, payload })

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('asaas-webhook: falha ao inserir webhook_events', insertEventError)
      throw insertEventError
    }

    if (payment.subscription) {
      const { data: subscription, error: subscriptionError } = await admin
        .from('subscriptions')
        .select('*, billing_plans!subscriptions_plan_id_fkey(billing_cycle)')
        .eq('asaas_subscription_id', payment.subscription)
        .maybeSingle()

      if (subscriptionError) {
        console.error('asaas-webhook: falha ao buscar subscription', subscriptionError)
        throw subscriptionError
      }

      if (subscription) {
        const { error: upsertError } = await admin.from('payment_charges').upsert(
          {
            subscription_id: subscription.id,
            asaas_payment_id: payment.id,
            status: payment.status,
            amount_cents: Math.round(payment.value * 100),
            due_date: payment.dueDate,
            billing_type: payment.billingType ?? null,
            invoice_url: payment.invoiceUrl ?? null,
            paid_at: CONFIRMED_EVENTS.has(event) ? new Date().toISOString() : null,
          },
          { onConflict: 'asaas_payment_id' },
        )

        if (upsertError) {
          console.error('asaas-webhook: falha ao gravar payment_charges', upsertError)
          throw upsertError
        }

        if (CONFIRMED_EVENTS.has(event) && REOPENABLE_STATUSES.has(subscription.status)) {
          const cycle = subscription.billing_plans?.billing_cycle ?? 'MONTHLY'
          const base = new Date(subscription.current_period_end) > new Date()
            ? new Date(subscription.current_period_end)
            : new Date()
          const nextPeriodEnd = addCycleMonths(base, cycle)

          const { error: reactivateError } = await admin
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: nextPeriodEnd.toISOString(),
              grace_period_ends_at: null,
            })
            .eq('id', subscription.id)

          if (reactivateError) {
            console.error('asaas-webhook: falha ao reativar subscription', reactivateError)
            throw reactivateError
          }
        } else if (OVERDUE_EVENTS.has(event) && REOPENABLE_STATUSES.has(subscription.status)) {
          const graceEnds = new Date()
          graceEnds.setUTCDate(graceEnds.getUTCDate() + 3)

          const { error: pastDueError } = await admin
            .from('subscriptions')
            .update({ status: 'past_due', grace_period_ends_at: graceEnds.toISOString() })
            .eq('id', subscription.id)

          if (pastDueError) {
            console.error('asaas-webhook: falha ao marcar subscription como past_due', pastDueError)
            throw pastDueError
          }
        }
      }
    }

    // --- Etapa 4.3: ramo de produto (pagamento avulso). Nao afeta assinaturas. ---
    const externalReference = payment.externalReference ?? ''
    if (!payment.subscription && externalReference.startsWith(PRODUCT_ORDER_PREFIX)) {
      await handleProductOrderEvent(
        admin,
        event,
        payment,
        externalReference.slice(PRODUCT_ORDER_PREFIX.length),
      )
    }

    const { error: processedAtError } = await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('asaas_event_id', eventId)

    if (processedAtError) {
      console.error('asaas-webhook: falha ao marcar processed_at', processedAtError)
      throw processedAtError
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('asaas-webhook: erro não tratado, processed_at não foi marcado', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
