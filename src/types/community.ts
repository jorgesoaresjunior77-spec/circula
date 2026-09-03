export type MembershipStatus = 'active' | 'pending' | 'blocked'

export interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  cover_image_url: string | null
  owner_id: string
  is_discoverable: boolean
  created_at: string
}

export interface CommunityMemberProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface CommunityMember {
  id: string
  status: MembershipStatus
  joined_at: string
  profile: CommunityMemberProfile | null
}

export interface CommunityWithMembers extends Community {
  community_members: CommunityMember[]
}

export type AddMemberResult =
  | { status: 'success'; fullName: string | null }
  | { status: 'already_member'; fullName: string | null }
  | { status: 'not_found' }
  | { status: 'error'; error: string }

export type JoinResult =
  | { status: 'success' }
  | { status: 'already_member' }
  | { status: 'error'; error: string }
