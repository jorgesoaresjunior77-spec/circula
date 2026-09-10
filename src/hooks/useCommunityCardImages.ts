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

export function useCommunityCardImages(communityId: string | null) {
  const [images, setImages] = useState<CommunityCardImages>({})
  const [loading, setLoading] = useState(!!communityId)

  const refresh = useCallback(async () => {
    if (!communityId) {
      setImages({})
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('community_card_images')
      .select('card_key, image_path')
      .eq('community_id', communityId)

    const next: CommunityCardImages = {}
    for (const row of (data as CardImageRow[] | null) ?? []) {
      if (row.image_path) next[row.card_key] = row.image_path
    }
    setImages(next)
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
