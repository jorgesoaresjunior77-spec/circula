import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CommunityEngagementCommand,
  EngagementCommandResult,
  PublishEngagementCommandResult,
} from '../types/engagementCommand'

const COMMAND_SELECT = 'id,community_id,title,content,is_active,created_by,created_at'

export function useEngagementCommands(communityId: string | null) {
  const [commands, setCommands] = useState<CommunityEngagementCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommands = useCallback(async () => {
    if (!communityId) {
      setCommands([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_engagement_commands')
      .select(COMMAND_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setCommands([])
      setLoading(false)
      return
    }

    setCommands((data as CommunityEngagementCommand[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchCommands()
  }, [fetchCommands])

  async function createCommand(
    createdBy: string,
    title: string,
    content: string,
  ): Promise<EngagementCommandResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('community_engagement_commands').insert({
      community_id: communityId,
      created_by: createdBy,
      title,
      content,
    })

    if (insertError) return { error: insertError.message }

    await fetchCommands()
    return { error: null }
  }

  async function updateCommand(
    commandId: string,
    title: string,
    content: string,
  ): Promise<EngagementCommandResult> {
    const { error: updateError } = await supabase
      .from('community_engagement_commands')
      .update({ title, content })
      .eq('id', commandId)

    if (updateError) return { error: updateError.message }

    setCommands((prev) =>
      prev.map((c) => (c.id === commandId ? { ...c, title, content } : c)),
    )
    return { error: null }
  }

  async function toggleActive(
    commandId: string,
    isActive: boolean,
  ): Promise<EngagementCommandResult> {
    const { error: updateError } = await supabase
      .from('community_engagement_commands')
      .update({ is_active: isActive })
      .eq('id', commandId)

    if (updateError) return { error: updateError.message }

    setCommands((prev) =>
      prev.map((c) => (c.id === commandId ? { ...c, is_active: isActive } : c)),
    )
    return { error: null }
  }

  async function deleteCommand(commandId: string): Promise<EngagementCommandResult> {
    const { error: deleteError } = await supabase
      .from('community_engagement_commands')
      .delete()
      .eq('id', commandId)

    if (deleteError) return { error: deleteError.message }

    setCommands((prev) => prev.filter((c) => c.id !== commandId))
    return { error: null }
  }

  async function publishEngagementCommand(): Promise<PublishEngagementCommandResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: publishError } = await supabase.rpc('publish_engagement_command', {
      p_community_id: communityId,
    })

    if (publishError) return { error: publishError.message }

    return { error: null }
  }

  return {
    commands,
    loading,
    error,
    createCommand,
    updateCommand,
    toggleActive,
    deleteCommand,
    publishEngagementCommand,
    refresh: fetchCommands,
  }
}
