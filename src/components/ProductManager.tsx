import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useProducts } from '../hooks/useProducts'
import type { Product, ProductCategory, ProductInput, ProductStatus } from '../types/product'
import { formatPriceBRL } from '../types/product'
import { ProductCard } from './ProductCard'
import { EmptyState } from './EmptyState'
import { ChevronLeftIcon, CloseIcon } from './icons'
import { useProductCheckout } from '../hooks/useProductCheckout'
import { useManagedContent } from '../hooks/useManagedContent'
import { recordView } from '../lib/itemViews'
import { useProductEntitlements } from '../hooks/useProductEntitlements'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useMyPackages } from '../hooks/usePackageAccess'
import { canReadEbooks } from '../lib/packages'
import { ProductPagesEditor } from './ProductPagesEditor'
import { ProductReader } from './ProductReader'
import { CoverImageInput } from './CoverImageInput'
import { ViewCount } from './ViewCount'
import { AnimatePresence, m, inViewOnce, riseVariants, staggerVariants, SPRING_SOFT, SPRING_TAP } from '../lib/motionKit'

// Loja por CATEGORIAS (rodada 2026-11-14):
//  - a profissional cria as categorias (ex.: "E-books"), cada uma um cartão
//    4:5 com imagem, no mesmo formato dos cartões da capa;
//  - dentro da categoria ficam os produtos, cada um com capa, título e
//    descrição; todos são digitais e lidos dentro do app (páginas em imagem,
//    sem limite de quantidade);
//  - saíram do cadastro: tipo, forma de entrega, evento online e local.

const gridStagger = staggerVariants(0.07, 0.1)
/** "Categoria" virtual dos produtos sem categoria (só aparece se houver algum). */
const UNCATEGORIZED = '__sem_categoria__'

interface ProductManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  // Habilita o botão "Comprar" nos produtos publicados (só Member).
  canBuy?: boolean
  /** Leva à página de Planos (produtos com cadeado). */
  onOpenPlans?: () => void
}

interface ProductFormValues {
  title: string
  description: string
  coverImageUrl: string
  price: string
  categoryId: string
}

const EMPTY_FORM: ProductFormValues = {
  title: '',
  description: '',
  coverImageUrl: '',
  price: '',
  categoryId: '',
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

/** Todo produto novo/editado é digital, lido no app. O que já estava salvo em
 *  campos antigos (link legado) é preservado a partir de `base`. */
function formToInput(values: ProductFormValues, base?: Product): ProductInput | { error: string } {
  const title = values.title.trim()
  if (!title) return { error: 'Informe um título.' }

  const priceCents = parsePriceToCents(values.price)
  if (priceCents === null) return { error: 'Informe um preço válido (ex.: 14,90).' }

  return {
    type: 'ebook',
    title,
    description: values.description.trim() || null,
    cover_image_url: values.coverImageUrl.trim() || null,
    price_cents: priceCents,
    max_quantity: null,
    deliverable_kind: 'none',
    deliverable_url: null,
    event_starts_at: null,
    event_is_online: null,
    event_location: null,
    requires_shipping: false,
    checkout_url: base?.checkout_url ?? null,
    category_id: values.categoryId || null,
  }
}

function productToForm(product: Product): ProductFormValues {
  return {
    title: product.title,
    description: product.description ?? '',
    coverImageUrl: product.cover_image_url ?? '',
    price: centsToPriceInput(product.price_cents),
    categoryId: product.category_id ?? '',
  }
}

interface ProductFieldsProps {
  idPrefix: string
  values: ProductFormValues
  onChange: (patch: Partial<ProductFormValues>) => void
  communityId: string
  profileId: string
  categories: ProductCategory[]
}

function ProductFields({ idPrefix, values, onChange, communityId, profileId, categories }: ProductFieldsProps) {
  return (
    <>
      <label htmlFor={`${idPrefix}-category`}>Categoria</label>
      <select
        id={`${idPrefix}-category`}
        value={values.categoryId}
        onChange={(e) => onChange({ categoryId: e.target.value })}
      >
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      {categories.length === 0 && (
        <p className="challenge-field-hint">Crie uma categoria acima (ex.: E-books) para organizar a Loja.</p>
      )}

      <label htmlFor={`${idPrefix}-title`}>Título</label>
      <input
        id={`${idPrefix}-title`}
        type="text"
        value={values.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Ex.: Ebook de autocuidado"
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
      <p className="challenge-field-hint">
        Todos os produtos são digitais e lidos aqui no app. Quem tem o pacote de E-books ou o plano completo lê
        sem pagar à parte; este preço vale para quem quiser comprar só este.
      </p>

      <CoverImageInput
        value={values.coverImageUrl}
        communityId={communityId}
        uid={profileId}
        label="Capa do produto"
        aspectRatio="4 / 5"
        recommendedSize="1080 × 1350 px"
        onChange={(path) => onChange({ coverImageUrl: path })}
      />
    </>
  )
}

/** Capa (categoria ou produto): caminho do Storage ou URL antiga. */
function Cover({ path, className }: { path: string | null; className: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className={className} /> : null
}

// ---- Categorias (profissional) ----------------------------------------------------
function CategoryManager({
  communityId,
  profileId,
  categories,
  products,
  save,
  remove,
}: {
  communityId: string
  profileId: string
  categories: ProductCategory[]
  products: Product[]
  save: (id: string | null, values: Record<string, unknown>) => Promise<{ error: string | null }>
  remove: (id: string) => Promise<{ error: string | null }>
}) {
  const [form, setForm] = useState<{ id: string | null; title: string; cover: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) {
      setError('Dê um nome à categoria.')
      return
    }
    setBusy(true)
    const values: Record<string, unknown> = { title: form.title.trim(), cover_image_url: form.cover || null }
    if (!form.id) values.position = categories.reduce((max, c) => Math.max(max, c.position), 0) + 1
    const r = await save(form.id, values)
    setBusy(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setForm(null)
    setError(null)
  }

  async function handleRemove(id: string) {
    setBusy(true)
    const r = await remove(id)
    setBusy(false)
    if (r.error) setError(r.error)
  }

  return (
    <div className="cat-manager">
      <h4 className="cat-manager-title">Categorias da Loja</h4>
      <p className="challenge-field-hint">
        Cada categoria vira um cartão na Loja (ex.: E-books, Guias, Cardápios). Os produtos ficam dentro dela.
      </p>

      {categories.length > 0 && (
        <ul className="cat-manager-list">
          {categories.map((c) => {
            const count = products.filter((p) => p.category_id === c.id).length
            return (
              <li key={c.id} className="cat-manager-item">
                <span className="cat-manager-thumb">
                  <Cover path={c.cover_image_url} className="cat-manager-thumb-img" />
                </span>
                <span className="cat-manager-name">
                  {c.title}
                  <small>{count === 1 ? '1 produto' : `${count} produtos`}</small>
                </span>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    setForm({ id: c.id, title: c.title, cover: c.cover_image_url ?? '' })
                    setError(null)
                  }}
                >
                  Editar
                </button>
                <button type="button" className="auth-link" disabled={busy} onClick={() => void handleRemove(c.id)}>
                  Excluir
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {!form && (
        <button
          type="button"
          className="store-new-btn"
          onClick={() => {
            setForm({ id: null, title: '', cover: '' })
            setError(null)
          }}
        >
          + Nova categoria
        </button>
      )}

      {form && (
        <form className="question-form" onSubmit={(e) => void submit(e)} aria-label={form.id ? 'Editar categoria' : 'Nova categoria'}>
          <label htmlFor="cat-title">Nome da categoria</label>
          <input
            id="cat-title"
            type="text"
            maxLength={80}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: E-books"
          />
          <CoverImageInput
            value={form.cover}
            communityId={communityId}
            uid={profileId}
            label="Imagem do cartão"
            aspectRatio="4 / 5"
            recommendedSize="1080 × 1350 px"
            onChange={(path) => setForm((f) => (f ? { ...f, cover: path } : f))}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar categoria'}
          </button>
          <button type="button" className="auth-link" onClick={() => setForm(null)}>
            Cancelar
          </button>
        </form>
      )}
      {!form && error && <p className="auth-error">{error}</p>}
    </div>
  )
}

export function ProductManager({
  communityId,
  profileId,
  canManage,
  canBuy = false,
  onOpenPlans,
}: ProductManagerProps) {
  const { products, loading, error, createProduct, updateProduct, setStatus, deleteProduct } =
    useProducts(communityId)
  const {
    items: categories,
    save: saveCategory,
    remove: removeCategory,
  } = useManagedContent<ProductCategory>('product_categories', communityId, 'position')

  const showBuy = canBuy && !canManage
  const { buyProduct, pendingProductId } = useProductCheckout()
  const { ownedProductIds, error: entitlementsError } = useProductEntitlements(communityId, showBuy)

  const [draft, setDraft] = useState<ProductFormValues>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  // Profissional: o formulário de novo produto fica recolhido até pedir.
  const [showForm, setShowForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ProductFormValues>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)

  // Membro: tem o pacote de E-books (ou o plano completo)? E qual produto está aberto no leitor.
  const { packages } = useMyPackages(communityId, profileId, showBuy)
  const canRead = canReadEbooks(packages)
  const [readingId, setReadingId] = useState<string | null>(null)
  const readingProduct = readingId ? (products.find((p) => p.id === readingId) ?? null) : null

  // Fundo da Loja (só a vitrine da membro usa).
  const { images: cardImages } = useCommunityCardImages(showBuy ? communityId : null)
  const { url: backgroundUrl } = useSignedImageUrl(
    cardImages.loja_fundo ?? cardImages.comunidade_grande ?? null,
  )

  // --- Vitrine (Member): categoria aberta e produto em detalhe ---
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const publishedProducts = products.filter((product) => product.status === 'published')
  const knownCategoryIds = new Set(categories.map((c) => c.id))
  const uncategorized = publishedProducts.filter((p) => !p.category_id || !knownCategoryIds.has(p.category_id))
  const selectedProduct = selectedProductId
    ? (products.find((product) => product.id === selectedProductId) ?? null)
    : null

  const openCategory = categories.find((c) => c.id === openCategoryId) ?? null
  const categoryProducts =
    openCategoryId === UNCATEGORIZED
      ? uncategorized
      : openCategory
        ? publishedProducts.filter((p) => p.category_id === openCategory.id)
        : []
  // Sem nenhuma categoria criada, a Loja mostra os produtos direto.
  const flatStore = categories.length === 0

  // Detalhe = overlay local. ESC fecha; rolagem do fundo trava enquanto aberto.
  useEffect(() => {
    if (!selectedProduct) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedProductId(null)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedProduct])

  function buyPropsFor(product: Product) {
    return {
      canBuy: showBuy,
      owned: ownedProductIds.has(product.id),
      buying: pendingProductId === product.id,
      onBuy: showBuy
        ? (p: Product) => buyProduct(p.id).then((r) => ({ error: r.error, invoiceUrl: r.invoiceUrl }))
        : undefined,
      onOpenPlans,
      canRead,
      onRead: (p: Product) => {
        setSelectedProductId(null)
        setReadingId(p.id)
        recordView(communityId, 'ebook', p.id)
      },
    }
  }

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
    setShowForm(false)
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditDraft(productToForm(product))
    setEditError(null)
    setActionError(null)
  }

  async function handleSaveEdit(formEvent: FormEvent, product: Product) {
    formEvent.preventDefault()
    setEditError(null)

    const input = formToInput(editDraft, product)
    if ('error' in input) {
      setEditError(input.error)
      return
    }

    setSavingEdit(true)
    const { error: updateErr } = await updateProduct(product.id, input)
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

  function renderProductTiles(list: Product[]) {
    if (list.length === 0) {
      return <p className="store-room-text">Em breve, novos conteúdos por aqui.</p>
    }
    return (
      <m.ul className="cat-products" {...inViewOnce} variants={gridStagger}>
        {list.map((product) => {
          const readable = canRead || ownedProductIds.has(product.id)
          return (
            <m.li key={product.id} variants={riseVariants}>
              <m.button
                type="button"
                className="cat-product"
                whileTap={{ scale: 0.97, transition: SPRING_TAP }}
                onClick={() => setSelectedProductId(product.id)}
                aria-label={`Ver detalhes de ${product.title}`}
              >
                <span className="cat-product-cover">
                  <Cover path={product.cover_image_url} className="cat-product-cover-img" />
                </span>
                <span className="cat-product-body">
                  <span className="cat-product-title">{product.title}</span>
                  {product.description && <span className="cat-product-desc">{product.description}</span>}
                  <span className="cat-product-foot">
                    {readable ? 'Ler agora' : product.price_cents > 0 ? formatPriceBRL(product.price_cents) : 'Ver'}
                  </span>
                </span>
              </m.button>
            </m.li>
          )
        })}
      </m.ul>
    )
  }

  return (
    <section
      className={`community-card community-card--quiet question-bank product-manager${
        showBuy ? ' product-manager--storefront' : ''
      }`}
    >
      {showBuy ? (
        <div className="store-masthead">
          <h2 className="store-masthead-title">Loja</h2>
        </div>
      ) : (
        <>
          <p className="section-label">Loja</p>
          <h3>Produtos da comunidade</h3>
        </>
      )}

      {canManage && (
        <CategoryManager
          communityId={communityId}
          profileId={profileId}
          categories={categories}
          products={products}
          save={saveCategory}
          remove={removeCategory}
        />
      )}

      {canManage && !showForm && (
        <div className="store-owner-actions">
          <button type="button" className="store-new-btn" onClick={() => setShowForm(true)}>
            + Novo produto
          </button>
        </div>
      )}

      {canManage && showForm && (
        <form onSubmit={handleCreate} className="question-form">
          <ProductFields
            idPrefix="new-product"
            communityId={communityId}
            profileId={profileId}
            values={draft}
            categories={categories}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
          <p className="challenge-field-hint">
            Depois de salvar, toque em "Editar e páginas" no produto para enviar as páginas (sem limite).
          </p>
          {createError && <p className="auth-error">{createError}</p>}
          <button type="submit" disabled={creating || !draft.title.trim()}>
            {creating ? 'Salvando...' : 'Adicionar produto'}
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setShowForm(false)
              setCreateError(null)
            }}
          >
            Cancelar
          </button>
        </form>
      )}

      {actionError && <p className="auth-error">{actionError}</p>}

      {showBuy && entitlementsError && (
        <p className="auth-error">
          Não foi possível verificar seus produtos já adquiridos. Recarregue a página.
        </p>
      )}

      {loading && showBuy && (
        <div className="store-skeleton" aria-hidden="true">
          <div className="store-skeleton-card" />
          <div className="store-skeleton-card" />
          <div className="store-skeleton-card" />
        </div>
      )}

      {loading && !showBuy && <p>Carregando produtos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && !showBuy && products.length === 0 && (
        <EmptyState message="Nenhum produto cadastrado ainda." />
      )}

      {!loading && !error && showBuy && (
        <div
          className="store-room store-room--categories"
          style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
        >
          <div className="store-room-veil">
            {flatStore ? (
              renderProductTiles(publishedProducts)
            ) : openCategoryId === null ? (
              <>
                <p className="store-room-text">Escolha uma categoria.</p>
                <m.ul className="cat-grid" {...inViewOnce} variants={gridStagger}>
                  {categories.map((c) => {
                    const count = publishedProducts.filter((p) => p.category_id === c.id).length
                    return (
                      <m.li key={c.id} variants={riseVariants}>
                        <m.button
                          type="button"
                          className="cat-card"
                          whileTap={{ scale: 0.96, transition: SPRING_TAP }}
                          onClick={() => setOpenCategoryId(c.id)}
                          aria-label={`Abrir a categoria ${c.title}`}
                        >
                          <span className="cat-card-frame">
                            <Cover path={c.cover_image_url} className="cat-card-photo" />
                            <span className="cat-card-title">{c.title}</span>
                            <span className="cat-card-meta">{count === 1 ? '1 item' : `${count} itens`}</span>
                          </span>
                        </m.button>
                      </m.li>
                    )
                  })}
                  {uncategorized.length > 0 && (
                    <m.li variants={riseVariants}>
                      <m.button
                        type="button"
                        className="cat-card"
                        whileTap={{ scale: 0.96, transition: SPRING_TAP }}
                        onClick={() => setOpenCategoryId(UNCATEGORIZED)}
                        aria-label="Abrir outros produtos"
                      >
                        <span className="cat-card-frame">
                          <span className="cat-card-title">Outros</span>
                          <span className="cat-card-meta">
                            {uncategorized.length === 1 ? '1 item' : `${uncategorized.length} itens`}
                          </span>
                        </span>
                      </m.button>
                    </m.li>
                  )}
                </m.ul>
              </>
            ) : (
              <>
                <button type="button" className="cat-back" onClick={() => setOpenCategoryId(null)}>
                  <ChevronLeftIcon size={16} /> Categorias
                </button>
                <h3 className="cat-open-title">{openCategory?.title ?? 'Outros'}</h3>
                {renderProductTiles(categoryProducts)}
              </>
            )}
          </div>
        </div>
      )}

      {!loading && !error && !showBuy && products.length > 0 && (
        <ul className="question-list product-list">
          {products.map((product) => (
            <li key={product.id} className="question-item product-item">
              {canManage && editingId === product.id ? (
                <form className="question-edit-form" onSubmit={(formEvent) => handleSaveEdit(formEvent, product)}>
                  <ProductFields
                    idPrefix={`edit-product-${product.id}`}
                    communityId={communityId}
                    profileId={profileId}
                    values={editDraft}
                    categories={categories}
                    onChange={(patch) => setEditDraft((prev) => ({ ...prev, ...patch }))}
                  />
                  <ProductPagesEditor productId={product.id} communityId={communityId} profileId={profileId} />
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
                  <ProductCard product={product} />
                  <p className="cat-product-where">
                    Categoria: {categories.find((c) => c.id === product.category_id)?.title ?? 'sem categoria'}
                    {canManage && (
                      <>
                        {' · '}
                        <ViewCount communityId={communityId} kind="ebook" itemId={product.id} />
                      </>
                    )}
                  </p>

                  {canManage && (
                    <div className="question-item-actions">
                      <button type="button" onClick={() => startEdit(product)}>
                        Editar e páginas
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
                        <button type="button" onClick={() => handleStatusChange(product.id, 'archived')}>
                          Arquivar
                        </button>
                      )}

                      {product.status === 'archived' && (
                        <button type="button" onClick={() => handleStatusChange(product.id, 'draft')}>
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

                  {canManage && product.status !== 'published' && product.price_cents <= 0 && (
                    <p className="question-empty">Defina um preço maior que zero para publicar.</p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {showBuy && selectedProduct && (
          <m.div
            key="product-detail"
            className="product-detail-backdrop product-detail-backdrop--motion"
            onClick={() => setSelectedProductId(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <m.div
              className="product-detail-panel"
              initial={{ opacity: 0, y: 36, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT }}
              exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.18 } }}
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${selectedProduct.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="product-detail-close"
                onClick={() => setSelectedProductId(null)}
                aria-label="Fechar"
              >
                <CloseIcon size={18} />
              </button>
              <ProductCard product={selectedProduct} variant="detail" {...buyPropsFor(selectedProduct)} />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {showBuy && readingProduct && <ProductReader product={readingProduct} onClose={() => setReadingId(null)} />}
    </section>
  )
}
