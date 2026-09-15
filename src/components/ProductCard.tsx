import { useState } from 'react'
import type { Product } from '../types/product'
import {
  PRODUCT_DELIVERABLE_KIND_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  formatPriceBRL,
  isEventProductType,
  isHotmartEligibleType,
} from '../types/product'

// V1 Hotmart: só considera o link se o tipo permite (ebook/course) E o
// valor é https:// — defesa em profundidade, mesma regra já aplicada
// na escrita (ProductManager), agora também checada na leitura.
function resolveHotmartUrl(product: Product): string | null {
  if (!isHotmartEligibleType(product.type)) return null
  if (!product.checkout_url) return null
  if (!/^https:\/\//i.test(product.checkout_url)) return null
  return product.checkout_url
}

interface ProductCardProps {
  product: Product
  // Compra (Member): quando ausente/false, o cartão é apenas informativo.
  canBuy?: boolean
  owned?: boolean
  buying?: boolean
  onBuy?: (product: Product) => Promise<{ error: string | null; invoiceUrl: string | null }>
}

export function ProductCard({
  product,
  canBuy = false,
  owned = false,
  buying = false,
  onBuy,
}: ProductCardProps) {
  const inactive = product.status !== 'published'
  const showEventInfo =
    isEventProductType(product.type) &&
    (product.event_starts_at !== null ||
      product.event_location !== null ||
      product.event_is_online !== null)

  const isPhysical = product.type === 'physical'
  const purchasable = canBuy && product.status === 'published'
  const hotmartUrl = resolveHotmartUrl(product)
  // Produto não físico já adquirido não pode ser comprado de novo (a regra é
  // reforçada no servidor por create_product_order + índice parcial).
  const alreadyOwned = owned && !isPhysical

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [lastInvoiceUrl, setLastInvoiceUrl] = useState<string | null>(null)

  async function handleBuy() {
    // V1 Hotmart: produto ebook/course com checkout_url válido nunca
    // passa pelo fluxo Asaas — abre o link externo e para por aqui.
    // useProductCheckout/onBuy não são chamados; nenhum product_order
    // é criado.
    if (hotmartUrl) {
      window.open(hotmartUrl, '_blank', 'noopener,noreferrer')
      return
    }

    if (!onBuy) return
    setFeedback(null)

    const result = await onBuy(product).catch(() => null)

    if (!result) {
      setFeedback({
        type: 'error',
        text: 'Não foi possível iniciar a compra agora. Tente novamente.',
      })
      return
    }

    const { error, invoiceUrl } = result

    if (error) {
      setFeedback({ type: 'error', text: error })
      return
    }

    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank', 'noopener,noreferrer')
      setLastInvoiceUrl(invoiceUrl)
    }

    setFeedback({
      type: 'success',
      text: 'Pedido criado. Conclua o pagamento na aba da Asaas que foi aberta.',
    })
  }

  const eventStart = product.event_starts_at
    ? new Date(product.event_starts_at).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  const hasMeta =
    showEventInfo ||
    product.max_quantity !== null ||
    product.deliverable_kind !== 'none' ||
    (isPhysical && product.requires_shipping)

  return (
    <article className="product-card">
      <div className="product-card-media">
        {product.cover_image_url ? (
          <img src={product.cover_image_url} alt="" className="product-card-image" />
        ) : (
          <div className="product-card-placeholder" aria-hidden="true">
            <span>{product.title.charAt(0).toUpperCase()}</span>
          </div>
        )}

        <div className="product-card-chips">
          <span className="chip">{PRODUCT_TYPE_LABELS[product.type]}</span>
          {(!canBuy || inactive) && (
            <span className="chip chip--muted">{PRODUCT_STATUS_LABELS[product.status]}</span>
          )}
        </div>
      </div>

      <div className="product-card-body">
        <h3 className="product-card-title">{product.title}</h3>

        {product.description && (
          <p className="product-card-description">{product.description}</p>
        )}

        {hasMeta && (
          <div className="product-card-meta">
            {showEventInfo && (
              <span>
                {eventStart ? `Início ${eventStart}` : 'Data a definir'}
                {product.event_is_online !== null
                  ? ` · ${product.event_is_online ? 'Online' : 'Presencial'}`
                  : ''}
                {product.event_location ? ` · ${product.event_location}` : ''}
              </span>
            )}
            {product.max_quantity !== null && (
              <span>
                {isPhysical ? 'Estoque' : 'Vagas'}: {product.max_quantity}
              </span>
            )}
            {product.deliverable_kind !== 'none' && (
              <span>{PRODUCT_DELIVERABLE_KIND_LABELS[product.deliverable_kind]}</span>
            )}
            {isPhysical && product.requires_shipping && <span>Requer envio</span>}
          </div>
        )}

        <p className="product-card-price">{formatPriceBRL(product.price_cents)}</p>

        {purchasable && (
          <div className="product-card-cta">
            {alreadyOwned ? (
              <span className="product-card-owned">✓ Adquirido</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBuy}
                disabled={buying}
              >
                {hotmartUrl ? 'Comprar na Hotmart' : buying ? 'Processando...' : 'Comprar'}
              </button>
            )}

            {owned && isPhysical && (
              <span className="product-card-owned">Você já comprou este produto</span>
            )}

            {lastInvoiceUrl && (
              <button
                type="button"
                className="auth-link"
                onClick={() => window.open(lastInvoiceUrl, '_blank', 'noopener,noreferrer')}
              >
                Reabrir pagamento
              </button>
            )}

            {feedback && (
              <p className={feedback.type === 'error' ? 'auth-error' : 'auth-success'}>
                {feedback.text}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
