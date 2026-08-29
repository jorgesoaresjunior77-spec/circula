import type { Profile } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import { useCommunityAccessBlocked } from '../hooks/useCommunityAccessBlocked'
import { CommunityView } from './CommunityView'
import { CommunityAccessBlockedCard } from './CommunityAccessBlockedCard'
import { CommunitySubscriptionCard } from './CommunitySubscriptionCard'
import { Feed } from './Feed'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { CheckinManager } from './CheckinManager'

interface MemberCommunityCardProps {
  community: CommunityWithMembers
  profile: Profile
  memberCount: number | undefined
  feedRefreshToken: number
  onFeedRefresh: () => void
}

export function MemberCommunityCard({
  community,
  profile,
  memberCount,
  feedRefreshToken,
  onFeedRefresh,
}: MemberCommunityCardProps) {
  const { blocked } = useCommunityAccessBlocked(profile, community.id)

  if (blocked) {
    return (
      <div className="community-block">
        <CommunityView
          community={community}
          memberCount={memberCount}
          badge="Você participa desta comunidade"
        />
        <CommunityAccessBlockedCard communityId={community.id} />
      </div>
    )
  }

  return (
    <div className="community-block">
      <CommunityView
        community={community}
        memberCount={memberCount}
        badge="Você participa desta comunidade"
      />
      <CommunitySubscriptionCard communityId={community.id} />
      <Feed
        communityId={community.id}
        authorId={profile.id}
        canPost
        refreshToken={feedRefreshToken}
      />
      <ChallengeManager
        communityId={community.id}
        profileId={profile.id}
        canManage={false}
        canParticipate
      />
      <CircleManager
        communityId={community.id}
        profileId={profile.id}
        canManage={false}
        canParticipate
      />
      <CheckinManager
        communityId={community.id}
        profileId={profile.id}
        canManage={false}
        canParticipate
        onShared={onFeedRefresh}
      />
    </div>
  )
}
