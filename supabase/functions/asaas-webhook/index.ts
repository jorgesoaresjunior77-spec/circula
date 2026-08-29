import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { addCycleMonths } from '../_shared/asaas.ts'

const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE'])
const REOPENABLE_STATUSES = new Set(['trial', 'active', 'past_due'])

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
    const payment = payload.payment as
      | { id: string; subscription?: string; status: string; dueDate: string; value: number; billingType?: string; invoiceUrl?: string }
      | undefined

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
