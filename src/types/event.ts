export type EventStatus = 'draft' | 'published' | 'cancelled'

export interface CommunityEvent {
  id: string
  community_id: string
  circle_id: string | null
  created_by: string
  title: string
  description: string | null
  cover_image_url: string | null
  starts_at: string
  ends_at: string | null
  is_online: boolean
  location: string | null
  online_url: string | null
  capacity: number | null
  status: EventStatus
  created_at: string
  updated_at: string
}

export interface EventParticipantProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface EventParticipant {
  id: string
  event_id: string
  profile_id: string
  joined_at: string
  profile: EventParticipantProfile | null
}

export interface EventWithParticipants extends CommunityEvent {
  participants: EventParticipant[]
}

export interface EventInput {
  title: string
  description?: string | null
  cover_image_url?: string | null
  starts_at: string
  ends_at?: string | null
  is_online: boolean
  location?: string | null
  online_url?: string | null
  capacity?: number | null
  circle_id?: string | null
  status?: EventStatus
}

export type EventResult = { error: string | null }
export type RsvpResult = { error: string | null }
