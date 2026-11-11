import { useState } from 'react'
import type { Product } from '../types/product'
import {
  PRODUCT_DELIVERABLE_KIND_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  formatPriceBRL,
  isDigitalProductType,
  isEventProductType,
} from '../types/product'

// Produtos digitais (e-book / curso) NÃO são mais vendidos um a um nem pela
// Hotmart: ficam liberados para quem tem o pacote de E-books ou o Superpacote.
// Para a membro, o cartão mostra um cadeado e o caminho para a página de
// Planos — nenhum pedido é criado e nenhum link externo é aberto. (O download
// dentro do Círcula entra numa etapa seguinte.) Os demais tipos seguem com a
// compra de sempre.

interface ProductCardProps {
  product: Product
  // Compra (Member): quando ausente/false, o cartão é apenas informativo.
  canBuy?: boolean
  owned?: boolean
  buying?: boolean
  onBuy?: (product: Product) => Promise<{ error: string | null; invoiceUrl: string | null }>
  // Redesign da vitrine: variant só troca a classe CSS (App.css escopa
  // por `.product-manager--storefront .product-card--*`) — a gestão
  // (ProfessionalPanel) nunca passa variant, então mantém o visual
  // clássico de sempre, intocado.
  variant?: 'grid' | 'featured' | 'detail'
  // Abre o detalhe (estado local no ProductManager). Omitido em modo
  // gestão e dentro do próprio detalhe — nada de rota nova.
  onSelect?: (product: Product) => void
  /** Leva à página de Planos (produto digital com cadeado). */
  onOpenPlans?: () => void
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function ProductCard({
  product,
  canBuy = false,
  owned = false,
  buying = false,
  onBuy,
  variant = 'grid',
  onSelect,
  onOpenPlans,
}: ProductCardProps) {
  const inactive = product.status !== 'published'
  const showEventInfo =
    isEventProductType(product.type) &&
    (product.event_starts_at !== null ||
      product.event_location !== null ||
      product.event_is_online !== null)

  const isPhysical = product.type === 'physical'
  const isDigital = isDigitalProductType(product.type)
  const purchasable = canBuy && product.status === 'published'
  // Produto não físico já adquirido não pode ser comprado de novo (a regra é
  // reforçada no servidor por create_product_order + índice parcial).
  const alreadyOwned = owned && !isPhysical
  // Digital sem acesso: cadeado + Planos, sem preço avulso.
  const planLocked = purchasable && isDigital && !alreadyOwned

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

  const cover = product.cover_image_url ? (
    <img loading="lazy" decoding="async" src={product.cover_image_url} alt="" className="product-card-image" />
  ) : (
    <div className="product-card-placeholder" aria-hidden="true">
      <span>{product.title.charAt(0).toUpperCase()}</span>
    </div>
  )

  const openDetail = onSelect ? () => onSelect(product) : undefined

  return (
    <article className={`product-card product-card--${variant}`}>
      <div className="product-card-media">
        {openDetail ? (
          <button
            type="button"
            className="product-card-media-open"
            onClick={openDetail}
            aria-label={`Ver detalhes de ${product.title}`}
          >
            {cover}
          </button>
        ) : (
          cover
        )}

        <div className="product-card-chips">
          <span className="chip">{PRODUCT_TYPE_LABELS[product.type]}</span>
          {(!canBuy || inactive) && (
            <span className="chip chip--muted">{PRODUCT_STATUS_LABELS[product.status]}</span>
          )}
        </div>
      </div>

      <div className="product-card-body">
        <h3 className="product-card-title">
          {openDetail ? (
            <button type="button" className="product-card-title-open" onClick={openDetail}>
              {product.title}
            </button>
          ) : (
            product.title
          )}
        </h3>

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

        {!planLocked && <p className="product-card-price">{formatPriceBRL(product.price_cents)}</p>}

        {planLocked && (
          <div className="product-card-cta product-card-lock">
            <p className="product-card-lock-text">
              <LockIcon />
              <span>Liberado para quem tem o pacote de E-books ou o Superpacote.</span>
            </p>
            {onOpenPlans && (
              <button type="button" className="btn btn-primary" onClick={onOpenPlans}>
                Ver planos
              </button>
            )}
          </div>
        )}

        {purchasable && !planLocked && (
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
                {buying ? 'Processando...' : 'Comprar'}
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
