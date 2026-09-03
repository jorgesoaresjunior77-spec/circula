import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JoyMoment, JoyMomentInput, JoyResult } from '../types/joy'

// Fase 4 — MOMENTO DE ALEGRIA. Molde de useContent/useRecipes.
//
// Tabela PRÓPRIA `joy_moments`, sem nenhuma relação com `posts` /
// `usePosts` / o Feed. useJoyMoments(null) não faz fetch.

const JOY_SELECT =
  'id,community_id,profile_id,body,image_url,created_at,updated_at,' +
  'author:profiles(id,full_name,avatar_url)'

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

export function useJoyMoments(communityId: string | null, profileId: string | null) {
  const [moments, setMoments] = useState<JoyMoment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMoments = useCallback(async () => {
    if (!communityId) {
      setMoments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('joy_moments')
      .select(JOY_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setMoments([])
      setLoading(false)
      return
    }

    setMoments((data as unknown as JoyMoment[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchMoments()
  }, [fetchMoments])

  async function createMoment(input: JoyMomentInput): Promise<JoyResult> {
    if (!communityId || !profileId) return { error: 'Sem comunidade selecionada.' }
    const body = cleanText(input.body)
    if (!body) return { error: 'Escreva algo antes de compartilhar.' }

    const { error: insertError } = await supabase.from('joy_moments').insert({
      community_id: communityId,
      profile_id: profileId,
      body,
      image_url: cleanText(input.image_url),
    })

    if (insertError) return { error: insertError.message }

    await fetchMoments()
    return { error: null }
  }

  async function updateMoment(momentId: string, input: JoyMomentInput): Promise<JoyResult> {
    const body = cleanText(input.body)
    if (!body) return { error: 'Escreva algo antes de salvar.' }

    const { error: updateError } = await supabase
      .from('joy_moments')
      .update({ body, image_url: cleanText(input.image_url) })
      .eq('id', momentId)

    if (updateError) return { error: updateError.message }

    await fetchMoments()
    return { error: null }
  }

  async function deleteMoment(momentId: string): Promise<JoyResult> {
    const { error: deleteError } = await supabase
      .from('joy_moments')
      .delete()
      .eq('id', momentId)

    if (deleteError) return { error: deleteError.message }

    setMoments((prev) => prev.filter((m) => m.id !== momentId))
    return { error: null }
  }

  return {
    moments,
    loading,
    error,
    createMoment,
    updateMoment,
    deleteMoment,
    refresh: fetchMoments,
  }
}
