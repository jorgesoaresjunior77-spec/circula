export interface Circle {
  id: string
  community_id: string
  name: string
  cover_image_url: string | null
  created_by: string
  created_at: string
}

export interface CircleMemberProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface CircleMember {
  id: string
  circle_id: string
  profile_id: string
  joined_at: string
  profile: CircleMemberProfile | null
}

export interface CircleWithMembers extends Circle {
  members: CircleMember[]
}

export type CircleResult = { error: string | null }
export type JoinCircleResult = { error: string | null }
