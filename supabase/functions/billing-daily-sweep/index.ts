import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MILESTONES: { key: 'd3' | 'd2' | 'd1' | 'due_today'; days: number }[] = [
  { key: 'd3', days: 3 },
  { key: 'd2', days: 2 },
  { key: 'd1', days: 1 },
  { key: 'due_today', days: 0 },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!authHeader.includes(serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'Somente service role pode executar esta função.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey)
    const nowIso = new Date().toISOString()

    const { data: blockedTrial } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'trial')
      .lte('trial_ends_at', nowIso)
      .select('id')

    const { data: blockedPastDue } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'past_due')
      .lte('grace_period_ends_at', nowIso)
      .select('id')

    const { data: blockedCanceled } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'canceled')
      .lte('current_period_end', nowIso)
      .select('id')

    let notificationsCreated = 0

    const { data: trialSubs } = await admin
      .from('subscriptions')
      .select('id, profile_id, trial_ends_at')
      .eq('status', 'trial')

    for (const sub of trialSubs ?? []) {
      const daysLeft = Math.ceil(
        (new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
      const milestone = MILESTONES.find((m) => m.days === daysLeft)
      if (!milestone) continue

      const { error: logError } = await admin
        .from('billing_notifications_log')
        .insert({ subscription_id: sub.id, milestone: milestone.key, channel: 'in_app' })

      if (!logError) {
        await admin.from('notifications').insert({
          profile_id: sub.profile_id,
          type: 'billing',
          title: 'Seu período de teste está terminando',
          body: `Faltam ${daysLeft} dia(s) para o fim do seu período de teste no Círcula.`,
          related_subscription_id: sub.id,
        })
        notificationsCreated += 1
      }
    }

    return new Response(
      JSON.stringify({
        blocked_trial: blockedTrial?.length ?? 0,
        blocked_past_due: blockedPastDue?.length ?? 0,
        blocked_canceled: blockedCanceled?.length ?? 0,
        notifications_created: notificationsCreated,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
