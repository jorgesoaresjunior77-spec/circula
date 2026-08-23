export interface CommunityChallenge {
  id: string
  community_id: string
  title: string
  description: string | null
  is_active: boolean
  created_by: string
  created_at: string
}

export interface ChallengeActivity {
  id: string
  challenge_id: string
  day_number: number
  content: string
}

export interface ChallengeWithActivities extends CommunityChallenge {
  activities: ChallengeActivity[]
}

export interface ChallengeParticipant {
  id: string
  challenge_id: string
  profile_id: string
  joined_at: string
}

export interface ChallengeProgressEntry {
  id: string
  challenge_id: string
  profile_id: string
  day_number: number
  completed_at: string
}

export interface ChallengeCommentAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface ChallengeComment {
  id: string
  challenge_id: string
  author_id: string
  content: string
  created_at: string
  author: ChallengeCommentAuthor | null
}

export type ChallengeResult = { error: string | null }
export type JoinChallengeResult = { error: string | null }
export type ToggleProgressResult = { error: string | null }
export type ChallengeCommentResult = { error: string | null }
