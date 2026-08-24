import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CircleResult, CircleWithMembers, JoinCircleResult } from '../types/circle'

const CIRCLE_SELECT =
  'id,community_id,name,created_by,created_at,members:circle_members(id,circle_id,profile_id,joined_at,profile:profiles(id,full_name,avatar_url))'

export function useCircles(communityId: string | null) {
  const [circles, setCircles] = useState<CircleWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCircles = useCallback(async () => {
    if (!communityId) {
      setCircles([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_circles')
      .select(CIRCLE_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setCircles([])
      setLoading(false)
      return
    }

    setCircles((data as unknown as CircleWithMembers[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchCircles()
  }, [fetchCircles])

  async function createCircle(createdBy: string, name: string): Promise<CircleResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('community_circles').insert({
      community_id: communityId,
      name,
      created_by: createdBy,
    })

    if (insertError) return { error: insertError.message }

    await fetchCircles()
    return { error: null }
  }

  async function renameCircle(circleId: string, name: string): Promise<CircleResult> {
    const { error: updateError } = await supabase
      .from('community_circles')
      .update({ name })
      .eq('id', circleId)

    if (updateError) return { error: updateError.message }

    setCircles((prev) =>
      prev.map((circle) => (circle.id === circleId ? { ...circle, name } : circle)),
    )
    return { error: null }
  }

  async function deleteCircle(circleId: string): Promise<CircleResult> {
    const { error: deleteError } = await supabase
      .from('community_circles')
      .delete()
      .eq('id', circleId)

    if (deleteError) return { error: deleteError.message }

    setCircles((prev) => prev.filter((circle) => circle.id !== circleId))
    return { error: null }
  }

  async function joinCircle(circleId: string, profileId: string): Promise<JoinCircleResult> {
    const { error: insertError } = await supabase.from('circle_members').insert({
      circle_id: circleId,
      profile_id: profileId,
    })

    if (insertError && !insertError.message.includes('duplicate key')) {
      return { error: insertError.message }
    }

    await fetchCircles()
    return { error: null }
  }

  async function leaveCircle(circleId: string, profileId: string): Promise<JoinCircleResult> {
    const { error: deleteError } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('profile_id', profileId)

    if (deleteError) return { error: deleteError.message }

    await fetchCircles()
    return { error: null }
  }

  return {
    circles,
    loading,
    error,
    createCircle,
    renameCircle,
    deleteCircle,
    joinCircle,
    leaveCircle,
    refresh: fetchCircles,
  }
}
