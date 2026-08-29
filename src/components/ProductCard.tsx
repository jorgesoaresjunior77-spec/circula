import { useState } from 'react'
import type { Product } from '../types/product'
import {
  PRODUCT_DELIVERABLE_KIND_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  formatPriceBRL,
  isEventProductType,
} from '../types/product'

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
  // Produto não físico já adquirido não pode ser comprado de novo (a regra é
  // reforçada no servidor por create_product_order + índice parcial).
  const alreadyOwned = owned && !isPhysical

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [lastInvoiceUrl, setLastInvoiceUrl] = useState<string | null>(null)

  async function handleBuy() {
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

  return (
    <article className="circle-card">
      <h3>{product.title}</h3>

      <p className="question-content">
        <span
          className={`question-status-badge${inactive ? ' question-status-badge--inactive' : ''}`}
        >
          {PRODUCT_STATUS_LABELS[product.status]}
        </span>{' '}
        <span className="question-status-badge">{PRODUCT_TYPE_LABELS[product.type]}</span>{' '}
        <strong>{formatPriceBRL(product.price_cents)}</strong>
      </p>

      {product.description && <p className="challenge-description">{product.description}</p>}

      {product.cover_image_url && (
        <p className="circle-meta">Imagem de capa: {product.cover_image_url}</p>
      )}

      {product.max_quantity !== null && (
        <p className="circle-meta">Quantidade máxima: {product.max_quantity}</p>
      )}

      {product.deliverable_kind !== 'none' && (
        <p className="circle-meta">
          Entrega: {PRODUCT_DELIVERABLE_KIND_LABELS[product.deliverable_kind]}
          {product.deliverable_url ? ` — ${product.deliverable_url}` : ''}
        </p>
      )}

      {showEventInfo && (
        <p className="circle-meta">
          {product.event_starts_at
            ? `Início: ${new Date(product.event_starts_at).toLocaleString('pt-BR')}`
            : 'Início não definido'}
          {product.event_is_online !== null
            ? ` · ${product.event_is_online ? 'Online' : 'Presencial'}`
            : ''}
          {product.event_location ? ` · ${product.event_location}` : ''}
        </p>
      )}

      {product.type === 'physical' && product.requires_shipping && (
        <p className="circle-meta">Requer envio</p>
      )}

      {purchasable && (
        <div className="question-item-actions">
          {alreadyOwned ? (
            <span className="question-status-badge">✓ Adquirido</span>
          ) : (
            <button type="button" onClick={handleBuy} disabled={buying}>
              {buying ? 'Processando...' : 'Comprar'}
            </button>
          )}

          {owned && isPhysical && (
            <span className="question-status-badge">Você já comprou este produto</span>
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
    </article>
  )
}
