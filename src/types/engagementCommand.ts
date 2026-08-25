export interface CommunityEngagementCommand {
  id: string
  community_id: string
  title: string
  content: string
  is_active: boolean
  created_by: string
  created_at: string
}

export type EngagementCommandResult = { error: string | null }
export type PublishEngagementCommandResult = { error: string | null }
