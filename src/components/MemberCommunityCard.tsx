import type { Profile } from '../types/profile'
import type { CommunityWithMembers } from '../types/community'
import { useCommunityAccessBlocked } from '../hooks/useCommunityAccessBlocked'
import { CommunityView } from './CommunityView'
import { CommunityAccessBlockedCard } from './CommunityAccessBlockedCard'
import { CommunityMembershipPendingCard } from './CommunityMembershipPendingCard'
import { CommunitySubscriptionCard } from './CommunitySubscriptionCard'
import { Feed } from './Feed'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { CheckinManager } from './CheckinManager'
import { PointsWidget } from './PointsWidget'
import { ProductManager } from './ProductManager'

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

  // Fase 12.3: solicitação ainda não aprovada — status já vem junto com
  // a comunidade (community_members_select permite a própria linha
  // independente do status), sem chamada extra.
  const myMembership = community.community_members.find(
    (member) => member.profile?.id === profile.id,
  )

  if (myMembership?.status === 'pending') {
    return (
      <div className="community-block">
        <CommunityView
          community={community}
          memberCount={memberCount}
          badge="Solicitação de entrada pendente"
        />
        <CommunityMembershipPendingCard />
      </div>
    )
  }

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
      <PointsWidget
        communityId={community.id}
        communityName={community.name}
        profileId={profile.id}
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
      <ProductManager
        communityId={community.id}
        profileId={profile.id}
        canManage={false}
        canBuy
      />
    </div>
  )
}
