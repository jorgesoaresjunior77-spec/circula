import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useProducts } from '../hooks/useProducts'
import type {
  Product,
  ProductDeliverableKind,
  ProductInput,
  ProductStatus,
  ProductType,
} from '../types/product'
import {
  PRODUCT_DELIVERABLE_KIND_LABELS,
  PRODUCT_TYPE_LABELS,
  isEventProductType,
} from '../types/product'
import { ProductCard } from './ProductCard'
import { EmptyState } from './EmptyState'
import { useProductCheckout } from '../hooks/useProductCheckout'
import { useProductEntitlements } from '../hooks/useProductEntitlements'

interface ProductManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  // Habilita o botão "Comprar" nos produtos publicados (só Member).
  canBuy?: boolean
}

const PRODUCT_TYPES: ProductType[] = [
  'course',
  'ebook',
  'workshop',
  'event',
  'consultation',
  'physical',
]

const DELIVERABLE_KINDS: ProductDeliverableKind[] = ['none', 'file', 'external_link', 'scheduling']

interface ProductFormValues {
  type: ProductType
  title: string
  description: string
  coverImageUrl: string
  price: string
  maxQuantity: string
  deliverableKind: ProductDeliverableKind
  deliverableUrl: string
  eventStartsAt: string
  eventIsOnline: boolean
  eventLocation: string
  requiresShipping: boolean
}

const EMPTY_FORM: ProductFormValues = {
  type: 'course',
  title: '',
  description: '',
  coverImageUrl: '',
  price: '',
  maxQuantity: '',
  deliverableKind: 'none',
  deliverableUrl: '',
  eventStartsAt: '',
  eventIsOnline: false,
  eventLocation: '',
  requiresShipping: false,
}

function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return 0
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

function centsToPriceInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function formToInput(values: ProductFormValues): ProductInput | { error: string } {
  const title = values.title.trim()
  if (!title) return { error: 'Informe um título.' }

  const priceCents = parsePriceToCents(values.price)
  if (priceCents === null) return { error: 'Informe um preço válido (ex.: 14,90).' }

  let maxQuantity: number | null = null
  const rawMax = values.maxQuantity.trim()
  if (rawMax !== '') {
    const parsed = Number(rawMax)
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: 'Quantidade máxima deve ser um número inteiro maior que zero.' }
    }
    maxQuantity = parsed
  }

  const event = isEventProductType(values.type)

  return {
    type: values.type,
    title,
    description: values.description.trim() || null,
    cover_image_url: values.coverImageUrl.trim() || null,
    price_cents: priceCents,
    max_quantity: maxQuantity,
    deliverable_kind: values.deliverableKind,
    deliverable_url: values.deliverableUrl.trim() || null,
    event_starts_at: event ? values.eventStartsAt.trim() || null : null,
    event_is_online: event ? values.eventIsOnline : null,
    event_location: event ? values.eventLocation.trim() || null : null,
    requires_shipping: values.type === 'physical' ? values.requiresShipping : false,
  }
}

function productToForm(product: Product): ProductFormValues {
  return {
    type: product.type,
    title: product.title,
    description: product.description ?? '',
    coverImageUrl: product.cover_image_url ?? '',
    price: centsToPriceInput(product.price_cents),
    maxQuantity: product.max_quantity !== null ? String(product.max_quantity) : '',
    deliverableKind: product.deliverable_kind,
    deliverableUrl: product.deliverable_url ?? '',
    eventStartsAt: product.event_starts_at ? product.event_starts_at.slice(0, 16) : '',
    eventIsOnline: product.event_is_online ?? false,
    eventLocation: product.event_location ?? '',
    requiresShipping: product.requires_shipping,
  }
}

interface ProductFieldsProps {
  idPrefix: string
  values: ProductFormValues
  onChange: (patch: Partial<ProductFormValues>) => void
}

function ProductFields({ idPrefix, values, onChange }: ProductFieldsProps) {
  const event = isEventProductType(values.type)
  const showDeliverableUrl =
    values.deliverableKind === 'external_link' || values.deliverableKind === 'scheduling'

  return (
    <>
      <label htmlFor={`${idPrefix}-type`}>Tipo</label>
      <select
        id={`${idPrefix}-type`}
        value={values.type}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange({ type: e.target.value as ProductType })
        }
      >
        {PRODUCT_TYPES.map((type) => (
          <option key={type} value={type}>
            {PRODUCT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <label htmlFor={`${idPrefix}-title`}>Título</label>
      <input
        id={`${idPrefix}-title`}
        type="text"
        value={values.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Ex.: Ebook de receitas afetivas"
        required
      />

      <label htmlFor={`${idPrefix}-description`}>Descrição</label>
      <textarea
        id={`${idPrefix}-description`}
        value={values.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={3}
        placeholder="Explique o que a participante recebe."
      />

      <label htmlFor={`${idPrefix}-price`}>Preço (R$)</label>
      <input
        id={`${idPrefix}-price`}
        type="text"
        inputMode="decimal"
        value={values.price}
        onChange={(e) => onChange({ price: e.target.value })}
        placeholder="Ex.: 14,90"
      />

      <label htmlFor={`${idPrefix}-cover`}>URL da imagem de capa (opcional)</label>
      <input
        id={`${idPrefix}-cover`}
        type="url"
        value={values.coverImageUrl}
        onChange={(e) => onChange({ coverImageUrl: e.target.value })}
        placeholder="https://..."
      />

      <label htmlFor={`${idPrefix}-max`}>Quantidade máxima (opcional)</label>
      <input
        id={`${idPrefix}-max`}
        type="number"
        min={1}
        value={values.maxQuantity}
        onChange={(e) => onChange({ maxQuantity: e.target.value })}
        placeholder="Vagas ou estoque"
      />

      <label htmlFor={`${idPrefix}-deliverable-kind`}>Forma de entrega</label>
      <select
        id={`${idPrefix}-deliverable-kind`}
        value={values.deliverableKind}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange({ deliverableKind: e.target.value as ProductDeliverableKind })
        }
      >
        {DELIVERABLE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {PRODUCT_DELIVERABLE_KIND_LABELS[kind]}
          </option>
        ))}
      </select>

      {showDeliverableUrl && (
        <>
          <label htmlFor={`${idPrefix}-deliverable-url`}>Link de entrega</label>
          <input
            id={`${idPrefix}-deliverable-url`}
            type="url"
            value={values.deliverableUrl}
            onChange={(e) => onChange({ deliverableUrl: e.target.value })}
            placeholder="https://..."
          />
        </>
      )}

      {event && (
        <>
          <label htmlFor={`${idPrefix}-event-start`}>Início do evento</label>
          <input
            id={`${idPrefix}-event-start`}
            type="datetime-local"
            value={values.eventStartsAt}
            onChange={(e) => onChange({ eventStartsAt: e.target.value })}
          />

          <label htmlFor={`${idPrefix}-event-online`}>
            <input
              id={`${idPrefix}-event-online`}
              type="checkbox"
              checked={values.eventIsOnline}
              onChange={(e) => onChange({ eventIsOnline: e.target.checked })}
            />{' '}
            Evento online
          </label>

          <label htmlFor={`${idPrefix}-event-location`}>Local do evento</label>
          <input
            id={`${idPrefix}-event-location`}
            type="text"
            value={values.eventLocation}
            onChange={(e) => onChange({ eventLocation: e.target.value })}
            placeholder="Endereço ou plataforma"
          />
        </>
      )}

      {values.type === 'physical' && (
        <label htmlFor={`${idPrefix}-requires-shipping`}>
          <input
            id={`${idPrefix}-requires-shipping`}
            type="checkbox"
            checked={values.requiresShipping}
            onChange={(e) => onChange({ requiresShipping: e.target.checked })}
          />{' '}
          Requer envio (endereço)
        </label>
      )}
    </>
  )
}

export function ProductManager({
  communityId,
  profileId,
  canManage,
  canBuy = false,
}: ProductManagerProps) {
  const { products, loading, error, createProduct, updateProduct, setStatus, deleteProduct } =
    useProducts(communityId)

  const showBuy = canBuy && !canManage
  const { buyProduct, pendingProductId } = useProductCheckout()
  const { ownedProductIds, error: entitlementsError } = useProductEntitlements(communityId, showBuy)

  const [draft, setDraft] = useState<ProductFormValues>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ProductFormValues>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)

  async function handleCreate(formEvent: FormEvent) {
    formEvent.preventDefault()
    setCreateError(null)

    const input = formToInput(draft)
    if ('error' in input) {
      setCreateError(input.error)
      return
    }

    setCreating(true)
    const { error: createErr } = await createProduct(profileId, input)
    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar o produto agora. Tente novamente.')
      return
    }

    setDraft(EMPTY_FORM)
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditDraft(productToForm(product))
    setEditError(null)
    setActionError(null)
  }

  async function handleSaveEdit(formEvent: FormEvent, productId: string) {
    formEvent.preventDefault()
    setEditError(null)

    const input = formToInput(editDraft)
    if ('error' in input) {
      setEditError(input.error)
      return
    }

    setSavingEdit(true)
    const { error: updateErr } = await updateProduct(productId, input)
    setSavingEdit(false)

    if (updateErr) {
      setEditError('Não foi possível salvar as alterações agora. Tente novamente.')
      return
    }

    setEditingId(null)
  }

  async function handleStatusChange(productId: string, status: ProductStatus) {
    setActionError(null)
    const { error: statusErr } = await setStatus(productId, status)
    if (statusErr) {
      setActionError('Não foi possível atualizar o status agora. Tente novamente.')
    }
  }

  async function handleDelete(productId: string) {
    setActionError(null)
    const { error: deleteErr } = await deleteProduct(productId)
    if (deleteErr) {
      setActionError('Não foi possível excluir o produto agora. Tente novamente.')
    }
  }

  return (
    <section
      className={`community-card community-card--quiet question-bank product-manager${
        showBuy ? ' product-manager--storefront' : ''
      }`}
    >
      <h3>Produtos da comunidade</h3>

      {canManage && (
        <form onSubmit={handleCreate} className="question-form">
          <ProductFields
            idPrefix="new-product"
            values={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
          {createError && <p className="auth-error">{createError}</p>}
          <button type="submit" disabled={creating || !draft.title.trim()}>
            {creating ? 'Salvando...' : 'Adicionar produto'}
          </button>
        </form>
      )}

      {actionError && <p className="auth-error">{actionError}</p>}

      {showBuy && entitlementsError && (
        <p className="auth-error">
          Não foi possível verificar seus produtos já adquiridos. Recarregue a página.
        </p>
      )}

      {loading && <p>Carregando produtos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && products.length === 0 && (
        <EmptyState message="Nenhum produto cadastrado ainda." />
      )}

      {!loading && !error && products.length > 0 && (
        <ul className="question-list product-list">
          {products.map((product) => (
            <li key={product.id} className="question-item product-item">
              {canManage && editingId === product.id ? (
                <form
                  className="question-edit-form"
                  onSubmit={(formEvent) => handleSaveEdit(formEvent, product.id)}
                >
                  <ProductFields
                    idPrefix={`edit-product-${product.id}`}
                    values={editDraft}
                    onChange={(patch) => setEditDraft((prev) => ({ ...prev, ...patch }))}
                  />
                  {editError && <p className="auth-error">{editError}</p>}
                  <div className="question-item-actions">
                    <button type="button" className="auth-link" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="question-save-button"
                      disabled={savingEdit || !editDraft.title.trim()}
                    >
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <ProductCard
                    product={product}
                    canBuy={showBuy}
                    owned={ownedProductIds.has(product.id)}
                    buying={pendingProductId === product.id}
                    onBuy={
                      showBuy
                        ? (p) =>
                            buyProduct(p.id).then((r) => ({
                              error: r.error,
                              invoiceUrl: r.invoiceUrl,
                            }))
                        : undefined
                    }
                  />

                  {canManage && (
                    <div className="question-item-actions">
                      <button type="button" onClick={() => startEdit(product)}>
                        Editar
                      </button>

                      {product.status !== 'published' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(product.id, 'published')}
                          disabled={product.price_cents <= 0}
                          title={
                            product.price_cents <= 0
                              ? 'Defina um preço maior que zero para publicar.'
                              : undefined
                          }
                        >
                          Publicar
                        </button>
                      )}

                      {product.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(product.id, 'archived')}
                        >
                          Arquivar
                        </button>
                      )}

                      {product.status === 'archived' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(product.id, 'draft')}
                        >
                          Voltar para rascunho
                        </button>
                      )}

                      <button
                        type="button"
                        className="question-delete-button"
                        onClick={() => handleDelete(product.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}

                  {canManage &&
                    product.status !== 'published' &&
                    product.price_cents <= 0 && (
                      <p className="question-empty">
                        Defina um preço maior que zero para publicar.
                      </p>
                    )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
