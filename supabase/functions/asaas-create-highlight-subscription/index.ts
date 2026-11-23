import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'
import { highlightPriceCents, isHighlightCycle } from '../_shared/highlightPlans.ts'

// Assinatura do DESTAQUE da capa de um negócio (R$ 4,90/mês; semestral e anual com desconto).
//   • só a dona (reivindicação aprovada pela administração) pode contratar;
//   • o preço vem só de _shared/highlightPlans.ts;
//   • cria o customer/assinatura no Asaas (Sandbox enquanto a chave for de teste) e grava
//     a linha em city_highlights como 'pending'; o webhook ativa quando o pagamento é confirmado.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HIGHLIGHT_REF_PREFIX = 'highlight:'

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
    const { listing_id: listingId, billing_cycle: cycle } = body as Record<string, unknown>
    if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) return json(400, { error: 'Cadastro inválido.', code: 'INVALID_LISTING' })
    if (!isHighlightCycle(cycle)) return json(400, { error: 'Ciclo inválido.', code: 'INVALID_CYCLE' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // só a dona aprovada
    const { data: listing } = await admin
      .from('city_listings')
      .select('id, status, reivindicado_por')
      .eq('id', listingId)
      .maybeSingle()
    if (!listing || listing.status !== 'ativo' || listing.reivindicado_por !== user.id) {
      return json(403, { error: 'Só a dona do negócio, com o pedido aprovado, pode contratar o destaque.', code: 'NOT_OWNER' })
    }

    const { data: billing } = await admin
      .from('billing_customer_data')
      .select('document_number')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!billing) return json(400, { error: 'Cadastre CPF/CNPJ antes de assinar.', code: 'MISSING_BILLING_DATA' })

    // já existe um destaque vivo? devolve a fatura em vez de duplicar
    const { data: existing } = await admin
      .from('city_highlights')
      .select('id, asaas_subscription_id')
      .eq('listing_id', listingId)
      .in('status', ['pending', 'active', 'past_due'])
      .maybeSingle()
    if (existing?.asaas_subscription_id) {
      const pay = await asaasFetch(`/payments?subscription=${existing.asaas_subscription_id}&limit=1`).catch(() => null)
      return json(200, { asaasSubscriptionId: existing.asaas_subscription_id, invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null, reused: true })
    }

    const priceCents = highlightPriceCents(cycle)
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
      .from('city_highlights')
      .insert({ listing_id: listingId, user_id: user.id, billing_cycle: cycle, price_cents: priceCents, asaas_customer_id: customerId })
      .select('id')
      .single()
    if (rowError || !row) {
      console.error('asaas-create-highlight-subscription: falha ao gravar', rowError)
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
          description: 'Círcula — Destaque do negócio',
          externalReference: `${HIGHLIGHT_REF_PREFIX}${row.id}`,
        }),
      })
      await admin
        .from('city_highlights')
        .update({ asaas_subscription_id: sub.id, atualizado_em: new Date().toISOString() })
        .eq('id', row.id)
      const pay = await asaasFetch(`/payments?subscription=${sub.id}&limit=1`).catch(() => null)
      return json(200, { asaasSubscriptionId: sub.id, invoiceUrl: pay?.data?.[0]?.invoiceUrl ?? null, reused: false })
    } catch (err) {
      await admin.from('city_highlights').delete().eq('id', row.id).is('asaas_subscription_id', null)
      console.error('asaas-create-highlight-subscription: Asaas falhou', (err as Error).message)
      return json(502, { error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.', code: 'ASAAS_FAILED' })
    }
  } catch (error) {
    console.error('asaas-create-highlight-subscription: erro inesperado', (error as Error).message)
    return json(500, { error: 'Erro inesperado.' })
  }
})
