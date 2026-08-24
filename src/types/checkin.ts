export type CheckinMood = 'great' | 'good' | 'okay' | 'hard'

export interface CommunityCheckin {
  id: string
  community_id: string
  content: string
  is_active: boolean
  created_by: string
  created_at: string
}

export interface CheckinInstance {
  id: string
  community_id: string
  checkin_id: string | null
  content: string
  published_by: string
  created_at: string
}

export interface CheckinResponseProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface CheckinResponse {
  id: string
  checkin_instance_id: string
  profile_id: string
  mood: CheckinMood
  wants_to_share: boolean
  created_at: string
  profile: CheckinResponseProfile | null
}

export type CheckinResult = { error: string | null }
export type PublishCheckinResult = { error: string | null }
export type RespondCheckinResult = { error: string | null }
export type ShareCheckinResult = { error: string | null }
