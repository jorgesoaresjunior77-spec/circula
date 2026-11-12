import { useState } from 'react'
import type { Product } from '../types/product'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import {
  PRODUCT_DELIVERABLE_KIND_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  formatPriceBRL,
  isDigitalProductType,
  isEventProductType,
} from '../types/product'

// Produtos digitais (e-book / curso): nada de Hotmart nem de link externo. A
// leitura é dentro do Círcula (leitor da revista). Quem tem o pacote de
// E-books ou o plano completo lê sem pagar à parte; quem não tem vê o preço e
// pode comprar aquele e-book (compra de sempre) — depois de pago, ele também
// fica liberado para leitura. Os demais tipos seguem com a compra de sempre.

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
  /** A membro tem o pacote de E-books ou o plano completo. */
  canRead?: boolean
  /** Abre o e-book no leitor, dentro do Círcula. */
  onRead?: (product: Product) => void
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
  canRead = false,
  onRead,
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
  // Digital: quem tem o pacote lê aqui mesmo; quem não tem vê o cadeado e o
  // caminho para Planos. Em nenhum dos casos há preço avulso.
  const readable = purchasable && isDigital && (canRead || alreadyOwned)
  // Digital ainda sem acesso: mostra o preço, o Comprar e a dica do plano.
  const planHint = purchasable && isDigital && !readable

  const { url: coverUrl } = useSignedImageUrl(product.cover_image_url)
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

  const cover = coverUrl ? (
    <img loading="lazy" decoding="async" src={coverUrl} alt="" className="product-card-image" />
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

        {!readable && <p className="product-card-price">{formatPriceBRL(product.price_cents)}</p>}

        {readable && (
          <div className="product-card-cta">
            <button type="button" className="btn btn-primary" onClick={() => onRead?.(product)}>
              Ler agora
            </button>
            <span className="product-card-owned">Leitura dentro do Círcula, sem baixar nada.</span>
          </div>
        )}

        {purchasable && !readable && (
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

        {planHint && (
          <div className="product-card-cta product-card-lock">
            <p className="product-card-lock-text">
              <LockIcon />
              <span>Com o pacote de E-books ou o plano completo, você lê este e os outros sem pagar à parte.</span>
            </p>
            {onOpenPlans && (
              <button type="button" className="auth-link" onClick={onOpenPlans}>
                Ver planos
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
