import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CheckinInstance,
  CheckinMood,
  CheckinResponse,
  CheckinResult,
  CommunityCheckin,
  PublishCheckinResult,
  RespondCheckinResult,
  ShareCheckinResult,
} from '../types/checkin'

const CHECKIN_SELECT = 'id,community_id,content,is_active,created_by,created_at'

const INSTANCE_SELECT = 'id,community_id,checkin_id,content,published_by,created_at'

const RESPONSE_SELECT =
  'id,checkin_instance_id,profile_id,mood,wants_to_share,created_at,profile:profiles(id,full_name,avatar_url)'

export function useCheckins(communityId: string | null) {
  const [checkins, setCheckins] = useState<CommunityCheckin[]>([])
  const [instances, setInstances] = useState<CheckinInstance[]>([])
  const [responsesByInstance, setResponsesByInstance] = useState<
    Record<string, CheckinResponse[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResponses = useCallback(async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return

    const { data } = await supabase
      .from('checkin_responses')
      .select(RESPONSE_SELECT)
      .in('checkin_instance_id', instanceIds)

    const grouped: Record<string, CheckinResponse[]> = {}
    for (const response of (data as unknown as CheckinResponse[] | null) ?? []) {
      grouped[response.checkin_instance_id] = [
        ...(grouped[response.checkin_instance_id] ?? []),
        response,
      ]
    }
    setResponsesByInstance((prev) => ({ ...prev, ...grouped }))
  }, [])

  const fetchAll = useCallback(async () => {
    if (!communityId) {
      setCheckins([])
      setInstances([])
      setResponsesByInstance({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [checkinsResult, instancesResult] = await Promise.all([
      supabase
        .from('community_checkins')
        .select(CHECKIN_SELECT)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false }),
      supabase
        .from('checkin_instances')
        .select(INSTANCE_SELECT)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false }),
    ])

    if (instancesResult.error) {
      setError(instancesResult.error.message)
      setCheckins([])
      setInstances([])
      setLoading(false)
      return
    }

    setCheckins((checkinsResult.data as CommunityCheckin[] | null) ?? [])
    const instanceList = (instancesResult.data as CheckinInstance[] | null) ?? []
    setInstances(instanceList)

    await fetchResponses(instanceList.map((instance) => instance.id))

    setLoading(false)
  }, [communityId, fetchResponses])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function createCheckin(createdBy: string, content: string): Promise<CheckinResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('community_checkins').insert({
      community_id: communityId,
      created_by: createdBy,
      content,
    })

    if (insertError) return { error: insertError.message }

    await fetchAll()
    return { error: null }
  }

  async function updateCheckin(checkinId: string, content: string): Promise<CheckinResult> {
    const { error: updateError } = await supabase
      .from('community_checkins')
      .update({ content })
      .eq('id', checkinId)

    if (updateError) return { error: updateError.message }

    setCheckins((prev) => prev.map((c) => (c.id === checkinId ? { ...c, content } : c)))
    return { error: null }
  }

  async function toggleActive(checkinId: string, isActive: boolean): Promise<CheckinResult> {
    const { error: updateError } = await supabase
      .from('community_checkins')
      .update({ is_active: isActive })
      .eq('id', checkinId)

    if (updateError) return { error: updateError.message }

    setCheckins((prev) =>
      prev.map((c) => (c.id === checkinId ? { ...c, is_active: isActive } : c)),
    )
    return { error: null }
  }

  async function deleteCheckin(checkinId: string): Promise<CheckinResult> {
    const { error: deleteError } = await supabase
      .from('community_checkins')
      .delete()
      .eq('id', checkinId)

    if (deleteError) return { error: deleteError.message }

    setCheckins((prev) => prev.filter((c) => c.id !== checkinId))
    return { error: null }
  }

  async function publishCheckin(): Promise<PublishCheckinResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: publishError } = await supabase.rpc('publish_checkin', {
      p_community_id: communityId,
    })

    if (publishError) return { error: publishError.message }

    await fetchAll()
    return { error: null }
  }

  async function respondCheckin(
    instanceId: string,
    profileId: string,
    mood: CheckinMood,
    wantsToShare: boolean,
  ): Promise<RespondCheckinResult> {
    const { error: insertError } = await supabase.from('checkin_responses').insert({
      checkin_instance_id: instanceId,
      profile_id: profileId,
      mood,
      wants_to_share: wantsToShare,
    })

    if (insertError) return { error: insertError.message }

    await fetchResponses([instanceId])
    return { error: null }
  }

  async function shareCheckin(
    authorId: string,
    content: string,
  ): Promise<ShareCheckinResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('posts').insert({
      community_id: communityId,
      author_id: authorId,
      content,
      post_type: 'checkin_share',
    })

    if (insertError) return { error: insertError.message }

    return { error: null }
  }

  return {
    checkins,
    instances,
    responsesByInstance,
    loading,
    error,
    createCheckin,
    updateCheckin,
    toggleActive,
    deleteCheckin,
    publishCheckin,
    respondCheckin,
    shareCheckin,
    refresh: fetchAll,
  }
}
