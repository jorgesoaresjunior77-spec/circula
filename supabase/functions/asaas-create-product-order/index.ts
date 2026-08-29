import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Traduz o SQLSTATE de create_product_order() em HTTP status.
function httpStatusForRpc(code: string | undefined, message: string): number {
  switch (code) {
    case '42501': // insufficient_privilege -> comprador nao e membro ativo
      return 403
    case '23505': // unique_violation -> ja adquirido / conflito de pedido
      return 409
    case 'P0002': // no_data_found -> produto inexistente
      return 404
    case '23503': // foreign_key_violation -> comunidade inexistente
      return 422
    case '22004': // null_value_not_allowed -> parametros ausentes
      return 400
    case '23514': // check_violation -> nao publicado / esgotado / preco / quantity
      return message.includes('esgotado') ? 409 : 422
    default:
      return 400
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
      return json(401, { error: 'Sem sessão ativa.' })
    }

    const payload = await req.json().catch(() => null)
    const productId = typeof payload?.product_id === 'string' ? payload.product_id.trim() : ''
    const idempotencyKey =
      typeof payload?.idempotency_key === 'string' ? payload.idempotency_key.trim() : ''

    if (!UUID_RE.test(productId)) {
      return json(400, { error: 'product_id inválido.', code: 'INVALID_PRODUCT_ID' })
    }
    if (!UUID_RE.test(idempotencyKey)) {
      return json(400, { error: 'idempotency_key inválido.', code: 'INVALID_IDEMPOTENCY_KEY' })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // --- 1. dados de cobrança do comprador (exigidos antes de criar o pedido) ---
    const { data: billingData } = await admin
      .from('billing_customer_data')
      .select('document_number, document_type')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!billingData) {
      return json(400, {
        error: 'Cadastre CPF/CNPJ antes de comprar.',
        code: 'MISSING_BILLING_DATA',
      })
    }

    // --- 2. resolve (ou cria) o customer Asaas do comprador ---
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    let asaasCustomerId: string | null = null

    const { data: mappedCustomer } = await admin
      .from('asaas_customers')
      .select('asaas_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    asaasCustomerId = mappedCustomer?.asaas_customer_id ?? null

    if (!asaasCustomerId) {
      const { data: subCustomer } = await admin
        .from('subscriptions')
        .select('asaas_customer_id')
        .eq('profile_id', user.id)
        .not('asaas_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      asaasCustomerId = subCustomer?.asaas_customer_id ?? null

      if (asaasCustomerId) {
        await admin
          .from('asaas_customers')
          .upsert(
            { profile_id: user.id, asaas_customer_id: asaasCustomerId },
            { onConflict: 'profile_id' },
          )
      }
    }

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

      asaasCustomerId = customer.id as string

      await admin
        .from('asaas_customers')
        .upsert(
          { profile_id: user.id, asaas_customer_id: asaasCustomerId },
          { onConflict: 'profile_id' },
        )
    }

    // --- 3. cria o pedido no servidor (valida publicado + membro + estoque + idempotência) ---
    const { data: orderId, error: rpcError } = await admin.rpc('create_product_order', {
      p_product_id: productId,
      p_buyer_profile_id: user.id,
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      return json(httpStatusForRpc(rpcError.code, rpcError.message ?? ''), {
        error: rpcError.message ?? 'Não foi possível criar o pedido.',
        code: rpcError.code ?? 'ORDER_CREATE_FAILED',
      })
    }

    // --- 4. carrega o pedido criado / reaproveitado ---
    const { data: order, error: orderError } = await admin
      .from('product_orders')
      .select(
        'id, buyer_profile_id, amount_total_cents, product_title_snapshot, split_model_snapshot, professional_wallet_id_snapshot, professional_amount_cents_snapshot, asaas_payment_id, invoice_url, status',
      )
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return json(500, { error: 'Pedido criado mas não pôde ser lido.' })
    }

    if (order.buyer_profile_id !== user.id) {
      return json(403, { error: 'Pedido não pertence a este usuário.' })
    }

    // --- 5. idempotência: pagamento Asaas já anexado -> devolve o mesmo link ---
    if (order.asaas_payment_id) {
      return json(200, {
        order_id: order.id,
        invoice_url: order.invoice_url,
        status: order.status,
        reused: true,
      })
    }

    // --- 6. cria a cobrança avulsa na Asaas (billingType UNDEFINED) ---
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: 'UNDEFINED',
      value: order.amount_total_cents / 100,
      dueDate,
      description: `Círcula — ${order.product_title_snapshot}`,
      externalReference: `product_order:${order.id}`,
    }

    if (order.split_model_snapshot === 'native' && order.professional_wallet_id_snapshot) {
      paymentBody.split = [
        {
          walletId: order.professional_wallet_id_snapshot,
          fixedValue: order.professional_amount_cents_snapshot / 100,
        },
      ]
    }

    const payment = await asaasFetch('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentBody),
    })

    // --- 7. anexa os dados da Asaas ao pedido (só se ainda não houver pagamento) ---
    const { data: updated, error: updateError } = await admin
      .from('product_orders')
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_payment_id: payment.id,
        invoice_url: payment.invoiceUrl ?? null,
        asaas_billing_type: payment.billingType ?? 'UNDEFINED',
        status: 'awaiting_payment',
      })
      .eq('id', order.id)
      .is('asaas_payment_id', null)
      .select('id, invoice_url, status')

    if (updateError) {
      return json(500, {
        error: 'Cobrança criada na Asaas mas o pedido não pôde ser atualizado.',
      })
    }

    if (!updated || updated.length === 0) {
      // chamada concorrente anexou o pagamento primeiro: devolve o vencedor
      const { data: fresh } = await admin
        .from('product_orders')
        .select('invoice_url, status')
        .eq('id', order.id)
        .single()

      return json(200, {
        order_id: order.id,
        invoice_url: fresh?.invoice_url ?? null,
        status: fresh?.status ?? 'awaiting_payment',
        reused: true,
      })
    }

    return json(200, {
      order_id: order.id,
      invoice_url: updated[0].invoice_url,
      status: updated[0].status,
      reused: false,
    })
  } catch (error) {
    return json(500, { error: (error as Error).message })
  }
})
