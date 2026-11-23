import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'

// Cancela o destaque da capa: para a cobrança no Asaas e tira o destaque NA HORA.
// Quem cancela é a dona do destaque (ou o master).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
    if (!user) return json({ error: 'Sem sessão ativa.' }, 401)

    const { highlight_id: highlightId } = (await req.json().catch(() => ({}))) as { highlight_id?: unknown }
    if (typeof highlightId !== 'string' || !UUID_RE.test(highlightId)) return json({ error: 'Pedido inválido.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: h } = await admin
      .from('city_highlights')
      .select('id, user_id, status, asaas_subscription_id')
      .eq('id', highlightId)
      .maybeSingle()
    if (!h) return json({ error: 'Assinatura não encontrada.' }, 404)

    if (h.user_id !== user.id) {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'master') return json({ error: 'Sem permissão para cancelar esta assinatura.' }, 403)
    }
    if (h.status === 'canceled') return json({ ok: true, alreadyCanceled: true })

    const subId = h.asaas_subscription_id as string | null
    if (subId && !subId.startsWith('__provisioning__')) {
      await asaasFetch(`/subscriptions/${subId}`, { method: 'DELETE' })
    }
    const nowIso = new Date().toISOString()
    await admin
      .from('city_highlights')
      .update({ status: 'canceled', current_period_end: nowIso, atualizado_em: nowIso })
      .eq('id', highlightId)
      .neq('status', 'canceled')

    try {
      await admin.from('notifications').insert({
        profile_id: h.user_id,
        type: 'billing',
        title: 'Destaque cancelado',
        body: 'O destaque da capa do seu negócio foi cancelado e não será cobrado de novo. O destaque saiu do ar agora, na hora.',
      })
    } catch (notifyError) {
      console.error('asaas-cancel-highlight: falha ao notificar', notifyError)
    }
    return json({ ok: true })
  } catch (error) {
    console.error('asaas-cancel-highlight: erro', error)
    return json({ error: 'Não foi possível cancelar agora. Tente novamente.' }, 500)
  }
})
