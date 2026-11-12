import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Páginas (imagens) de um e-book da Loja, lidas no leitor da revista. A RLS
// decide o que cada papel enxerga: a dona vê tudo; a membro só vê as páginas
// de produto publicado e se tiver o pacote de E-books, o plano completo ou
// tiver comprado aquele e-book. Sem limite de páginas (há e-books de vários
// tamanhos).

export interface ProductPage {
  id: string
  product_id: string
  position: number
  image_path: string
}

type Result = { error: string | null }

export function useProductPages(productId: string | null, communityId: string | null) {
  const [loaded, setLoaded] = useState<{ productId: string; pages: ProductPage[] } | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('product_pages')
        .select('id,product_id,position,image_path')
        .eq('product_id', productId)
        .order('position', { ascending: true })
      if (!cancelled) setLoaded({ productId, pages: (data as ProductPage[] | null) ?? [] })
    })()
    return () => {
      cancelled = true
    }
  }, [productId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])
  const ready = !!loaded && loaded.productId === productId
  const pages = ready ? loaded.pages : []

  const addPage = useCallback(
    async (imagePath: string): Promise<Result> => {
      if (!productId || !communityId) return { error: 'Salve o produto antes de adicionar páginas.' }
      const next = pages.reduce((max, p) => Math.max(max, p.position), 0) + 1
      const { error } = await supabase.from('product_pages').insert({
        product_id: productId,
        community_id: communityId,
        position: next,
        image_path: imagePath,
      })
      if (error) return { error: 'Não foi possível salvar a página agora.' }
      reload()
      return { error: null }
    },
    [productId, communityId, pages, reload],
  )

  const removePage = useCallback(
    async (pageId: string): Promise<Result> => {
      const { error } = await supabase.from('product_pages').delete().eq('id', pageId)
      if (error) return { error: 'Não foi possível remover agora.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { pages, ready, addPage, removePage }
}
