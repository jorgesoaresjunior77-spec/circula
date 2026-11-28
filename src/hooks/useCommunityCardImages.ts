import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityCardKey } from '../types/communityCards'

// Lê e grava as imagens (só VISUAIS) dos 6 cards de experiência da Home
// da comunidade. Molde de useCommunityBillingSettings: uma linha por
// (community_id, card_key) em `community_card_images`. Leitura por
// SELECT direto (RLS = Master / dona / membro); escrita por upsert /
// delete (RLS = só a dona). O arquivo já foi enviado ao bucket
// `community-media` pelo CoverImageInput; aqui guardamos só o PATH.

export type CommunityCardImages = Partial<Record<CommunityCardKey, string>>

interface CardImageRow {
  card_key: CommunityCardKey
  image_path: string
}

// Última lista conhecida guardada no aparelho: ao abrir o app, a Home já
// nasce com as imagens (topo, cards) da visita anterior e não pisca o layout
// sem foto enquanto a consulta volta. A consulta continua rodando e corrige.
const CACHE_PREFIX = 'circula:card-images:v1:'

function readCached(communityId: string | null): CommunityCardImages | null {
  if (!communityId) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + communityId)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as CommunityCardImages) : null
  } catch {
    return null
  }
}

function writeCached(communityId: string, images: CommunityCardImages) {
  try {
    localStorage.setItem(CACHE_PREFIX + communityId, JSON.stringify(images))
  } catch {
    /* sem storage: segue sem cache */
  }
}

/** Caminho da imagem do topo guardado da última visita (qualquer comunidade). */
export function cachedHeroPath(): string | null {
  try {
    return localStorage.getItem('circula:last-hero-path')
  } catch {
    return null
  }
}

export function useCommunityCardImages(communityId: string | null) {
  const [images, setImages] = useState<CommunityCardImages>(() => readCached(communityId) ?? {})
  const [loading, setLoading] = useState(!!communityId && !readCached(communityId))
  const [cachedFor, setCachedFor] = useState(communityId)
  if (cachedFor !== communityId) {
    // Trocou a comunidade (ex.: chegou depois do carregamento): já mostra o que o aparelho guardou dela.
    setCachedFor(communityId)
    setImages(readCached(communityId) ?? {})
  }

  const refresh = useCallback(async () => {
    if (!communityId) {
      setImages({})
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('community_card_images')
      .select('card_key, image_path')
      .eq('community_id', communityId)

    if (error) {
      // Falha de rede: mantém o que já estava na tela (cache), sem apagar as imagens.
      setLoading(false)
      return
    }
    const next: CommunityCardImages = {}
    for (const row of (data as CardImageRow[] | null) ?? []) {
      if (row.image_path) next[row.card_key] = row.image_path
    }
    setImages(next)
    writeCached(communityId, next)
    try {
      const hero = next.hero_1
      if (hero) localStorage.setItem('circula:last-hero-path', hero)
      else localStorage.removeItem('circula:last-hero-path')
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setImage = useCallback(
    async (cardKey: CommunityCardKey, imagePath: string, updatedBy: string) => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { error } = await supabase.from('community_card_images').upsert(
        {
          community_id: communityId,
          card_key: cardKey,
          image_path: imagePath,
          updated_by: updatedBy,
        },
        { onConflict: 'community_id,card_key' },
      )
      if (error) return { error: error.message }
      await refresh()
      return { error: null as string | null }
    },
    [communityId, refresh],
  )

  const clearImage = useCallback(
    async (cardKey: CommunityCardKey) => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { error } = await supabase
        .from('community_card_images')
        .delete()
        .eq('community_id', communityId)
        .eq('card_key', cardKey)
      if (error) return { error: error.message }
      await refresh()
      return { error: null as string | null }
    },
    [communityId, refresh],
  )

  return { images, loading, setImage, clearImage, refresh }
}
