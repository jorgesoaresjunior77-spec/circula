import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// FASE 16.2.4-C — Sweep diário do ciclo de cobrança
// =====================================================================
// Executado por um agendador EXTERNO (GitHub Actions / pg_cron) que
// envia a `service_role` key no header Authorization. Nunca confia em
// dado do cliente. NÃO cria cobrança, NÃO cria/altera payout, NÃO toca
// `current_period_end` nem `payment_charges`/`subscription_payouts` —
// só faz transições de `subscriptions.status` e escreve notificações.
//
// Idempotente: cada `UPDATE` de bloqueio filtra pelo status de ORIGEM
// (re-rodar não re-transiciona nada); cada notificação passa por
// `billing_notifications_log` (UNIQUE (subscription_id, milestone,
// channel)) — no máximo uma por marco, por assinatura.
//
// Trata:
//   A) trial expirado  -> blocked
//   B) past_due com grace vencido (ou sem grace) -> blocked + aviso
//   C) período de graça: enforcement do `grace_period_ends_at` já
//      gravado pela `asaas-webhook` (3 dias — regra existente do projeto,
//      NÃO inventada aqui)
//   D) bloqueio após término da tolerância (idem B)
//   E) assinatura recém-bloqueada -> notificação 'blocked'
//   F) pagamento confirmado posterior -> reativação é da `asaas-webhook`
//      (past_due/blocked -> active); o sweep NÃO reativa nada
//   G) assinatura cancelada -> blocked quando `current_period_end`
//      passou (acesso mantido até o fim do período já pago); o sweep
//      NUNCA reativa `canceled`
// =====================================================================

const MILESTONES: { key: 'd3' | 'd2' | 'd1' | 'due_today'; days: number }[] = [
  { key: 'd3', days: 3 },
  { key: 'd2', days: 2 },
  { key: 'd1', days: 1 },
  { key: 'due_today', days: 0 },
]

type Admin = ReturnType<typeof createClient>

// Notifica UMA vez por (assinatura, marco). O `billing_notifications_log`
// (UNIQUE) é a chave de idempotência: um 23505 ao gravar o log significa
// "já notificado" -> não cria segunda notificação.
async function notifyOnce(
  admin: Admin,
  subId: string,
  profileId: string,
  milestone: string,
  title: string,
  body: string,
): Promise<boolean> {
  const { error: logErr } = await admin
    .from('billing_notifications_log')
    .insert({ subscription_id: subId, milestone, channel: 'in_app' })
  if (logErr) return false // 23505 -> já notificado; qualquer erro -> não duplica

  const { error: notifErr } = await admin.from('notifications').insert({
    profile_id: profileId,
    type: 'billing',
    title,
    body,
    related_subscription_id: subId,
  })
  if (notifErr) {
    console.error('billing-daily-sweep: falha ao inserir notification', subId, milestone, notifErr)
    return false
  }
  return true
}

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

    // --- A: trial expirado -> blocked (idempotente: filtra status='trial') ---
    const { data: blockedTrial } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'trial')
      .lte('trial_ends_at', nowIso)
      .select('id, profile_id')

    // --- B/C/D: past_due com grace vencido -> blocked ---
    const { data: blockedGrace } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'past_due')
      .lte('grace_period_ends_at', nowIso)
      .select('id, profile_id')

    // past_due SEM janela de graça registrada = sem proteção -> blocked.
    // (A `asaas-webhook` sempre grava `grace_period_ends_at` ao pôr em
    //  past_due; isto cobre apenas anomalias de dado.)
    const { data: blockedGraceMissing } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'past_due')
      .is('grace_period_ends_at', null)
      .select('id, profile_id')

    // --- G: cancelada com período já pago encerrado -> blocked ---
    const { data: blockedCanceled } = await admin
      .from('subscriptions')
      .update({ status: 'blocked' })
      .eq('status', 'canceled')
      .lte('current_period_end', nowIso)
      .select('id, profile_id')

    const justBlocked = [
      ...(blockedTrial ?? []),
      ...(blockedGrace ?? []),
      ...(blockedGraceMissing ?? []),
      ...(blockedCanceled ?? []),
    ]

    let notificationsCreated = 0

    // --- E: aviso de bloqueio (uma vez por assinatura) ---
    for (const sub of justBlocked) {
      const ok = await notifyOnce(
        admin,
        sub.id as string,
        sub.profile_id as string,
        'blocked',
        'Acesso à assinatura bloqueado',
        'O período da sua assinatura terminou sem pagamento confirmado. Regularize para voltar a ter acesso — nenhum dado foi apagado.',
      )
      if (ok) notificationsCreated += 1
    }

    // --- B: aviso de pagamento vencido (past_due) — uma vez por assinatura ---
    const { data: pastDueSubs } = await admin
      .from('subscriptions')
      .select('id, profile_id')
      .eq('status', 'past_due')

    for (const sub of pastDueSubs ?? []) {
      const ok = await notifyOnce(
        admin,
        sub.id as string,
        sub.profile_id as string,
        'past_due',
        'Pagamento pendente',
        'Encontramos um pagamento da sua assinatura em aberto. Regularize para não perder o acesso quando a tolerância terminar.',
      )
      if (ok) notificationsCreated += 1
    }

    // --- A: fim de trial se aproximando (d3 / d2 / d1 / due_today) ---
    const { data: trialSubs } = await admin
      .from('subscriptions')
      .select('id, profile_id, trial_ends_at')
      .eq('status', 'trial')

    for (const sub of trialSubs ?? []) {
      const daysLeft = Math.ceil(
        (new Date(sub.trial_ends_at as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
      const milestone = MILESTONES.find((m) => m.days === daysLeft)
      if (!milestone) continue

      const ok = await notifyOnce(
        admin,
        sub.id as string,
        sub.profile_id as string,
        milestone.key,
        'Seu período de teste está terminando',
        `Faltam ${daysLeft} dia(s) para o fim do seu período de teste no Círcula.`,
      )
      if (ok) notificationsCreated += 1
    }

    return new Response(
      JSON.stringify({
        blocked_trial: blockedTrial?.length ?? 0,
        blocked_grace: (blockedGrace?.length ?? 0) + (blockedGraceMissing?.length ?? 0),
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
