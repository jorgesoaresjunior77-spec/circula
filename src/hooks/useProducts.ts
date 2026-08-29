import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, ProductInput, ProductResult, ProductStatus } from '../types/product'

const PRODUCT_SELECT =
  'id,community_id,created_by,type,title,description,cover_image_url,price_cents,currency,status,max_quantity,deliverable_kind,deliverable_url,deliverable_file_path,event_starts_at,event_is_online,event_location,requires_shipping,created_at,updated_at'

// Colunas que a interface escreve. Espelha ProductInput (nomes do banco).
function inputToRow(input: ProductInput) {
  return {
    type: input.type,
    title: input.title,
    description: input.description,
    cover_image_url: input.cover_image_url,
    price_cents: input.price_cents,
    max_quantity: input.max_quantity,
    deliverable_kind: input.deliverable_kind,
    deliverable_url: input.deliverable_url,
    event_starts_at: input.event_starts_at,
    event_is_online: input.event_is_online,
    event_location: input.event_location,
    requires_shipping: input.requires_shipping,
  }
}

export function useProducts(communityId: string | null) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!communityId) {
      setProducts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setProducts([])
      setLoading(false)
      return
    }

    setProducts((data as Product[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  async function createProduct(createdBy: string, input: ProductInput): Promise<ProductResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('products').insert({
      community_id: communityId,
      created_by: createdBy,
      ...inputToRow(input),
    })

    if (insertError) return { error: insertError.message }

    await fetchProducts()
    return { error: null }
  }

  async function updateProduct(productId: string, input: ProductInput): Promise<ProductResult> {
    const row = inputToRow(input)

    const { error: updateError } = await supabase.from('products').update(row).eq('id', productId)

    if (updateError) return { error: updateError.message }

    setProducts((prev) =>
      prev.map((product) => (product.id === productId ? { ...product, ...row } : product)),
    )
    return { error: null }
  }

  async function setStatus(productId: string, status: ProductStatus): Promise<ProductResult> {
    const { error: updateError } = await supabase
      .from('products')
      .update({ status })
      .eq('id', productId)

    if (updateError) return { error: updateError.message }

    setProducts((prev) =>
      prev.map((product) => (product.id === productId ? { ...product, status } : product)),
    )
    return { error: null }
  }

  async function deleteProduct(productId: string): Promise<ProductResult> {
    const { error: deleteError } = await supabase.from('products').delete().eq('id', productId)

    if (deleteError) return { error: deleteError.message }

    setProducts((prev) => prev.filter((product) => product.id !== productId))
    return { error: null }
  }

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    setStatus,
    deleteProduct,
    refresh: fetchProducts,
  }
}
