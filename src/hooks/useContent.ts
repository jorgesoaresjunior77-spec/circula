import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityContent, ContentInput, ContentResult } from '../types/content'

// Módulo BIBLIOTECA. Mesmo molde de useEvents/useCircles.
// useContent(null) não faz fetch.

const CONTENT_SELECT =
  `id,community_id,circle_id,created_by,type,title,summary,body,cover_image_url,` +
  `external_url,category,status,created_at,updated_at,` +
  `author:profiles(id,full_name,avatar_url),` +
  `likes:content_likes(id,content_id,profile_id,created_at)`

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

export function useContent(communityId: string | null) {
  const [items, setItems] = useState<CommunityContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!communityId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_content')
      .select(CONTENT_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setItems([])
      setLoading(false)
      return
    }

    setItems((data as unknown as CommunityContent[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  function payload(input: ContentInput) {
    return {
      type: input.type,
      title: input.title.trim(),
      summary: cleanText(input.summary),
      body: cleanText(input.body),
      cover_image_url: cleanText(input.cover_image_url),
      external_url: cleanText(input.external_url),
      category: cleanText(input.category),
      circle_id: input.circle_id || null,
      status: input.status ?? 'published',
    }
  }

  async function createContent(createdBy: string, input: ContentInput): Promise<ContentResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase
      .from('community_content')
      .insert({ community_id: communityId, created_by: createdBy, ...payload(input) })

    if (insertError) return { error: insertError.message }

    await fetchItems()
    return { error: null }
  }

  async function updateContent(contentId: string, input: ContentInput): Promise<ContentResult> {
    const { error: updateError } = await supabase
      .from('community_content')
      .update(payload(input))
      .eq('id', contentId)

    if (updateError) return { error: updateError.message }

    await fetchItems()
    return { error: null }
  }

  async function deleteContent(contentId: string): Promise<ContentResult> {
    const { error: deleteError } = await supabase
      .from('community_content')
      .delete()
      .eq('id', contentId)

    if (deleteError) return { error: deleteError.message }

    setItems((prev) => prev.filter((item) => item.id !== contentId))
    return { error: null }
  }

  async function toggleLike(
    contentId: string,
    profileId: string,
    liked: boolean,
  ): Promise<ContentResult> {
    if (liked) {
      const { error: delError } = await supabase
        .from('content_likes')
        .delete()
        .eq('content_id', contentId)
        .eq('profile_id', profileId)
      if (delError) return { error: delError.message }
    } else {
      const { error: insError } = await supabase
        .from('content_likes')
        .insert({ content_id: contentId, profile_id: profileId })
      if (insError && !insError.message.includes('duplicate key')) {
        return { error: insError.message }
      }
    }

    await fetchItems()
    return { error: null }
  }

  return {
    items,
    loading,
    error,
    createContent,
    updateContent,
    deleteContent,
    toggleLike,
    refresh: fetchItems,
  }
}
