import { useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ProductCheckoutResult {
  error: string | null
  invoiceUrl: string | null
  orderId: string | null
  status: string | null
}

// Aciona a Edge Function asaas-create-product-order. O frontend envia SOMENTE
// product_id + idempotency_key (UUID novo por tentativa). Preço, valor, comprador,
// split e quantidade são resolvidos exclusivamente no servidor (auth.getUser +
// create_product_order). O acesso ao produto continua sendo product_entitlements.
export function useProductCheckout() {
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)

  async function buyProduct(productId: string): Promise<ProductCheckoutResult> {
    setPendingProductId(productId)

    try {
      const { data, error } = await supabase.functions.invoke('asaas-create-product-order', {
        body: { product_id: productId, idempotency_key: crypto.randomUUID() },
      })

      if (error) {
        let message = 'Não foi possível iniciar a compra agora. Tente novamente.'
        const context = (error as unknown as { context?: Response }).context
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json()
            if (body && typeof body.error === 'string') message = body.error
          } catch {
            // mantém a mensagem genérica
          }
        }
        return { error: message, invoiceUrl: null, orderId: null, status: null }
      }

      return {
        error: null,
        invoiceUrl: (data?.invoice_url as string | null) ?? null,
        orderId: (data?.order_id as string | null) ?? null,
        status: (data?.status as string | null) ?? null,
      }
    } catch {
      // crypto.randomUUID() indisponível ou falha de rede em functions.invoke:
      // nunca propaga — devolve erro tratável; o finally limpa o pendente.
      return {
        error: 'Não foi possível iniciar a compra agora. Tente novamente.',
        invoiceUrl: null,
        orderId: null,
        status: null,
      }
    } finally {
      setPendingProductId(null)
    }
  }

  return { buyProduct, pendingProductId }
}
