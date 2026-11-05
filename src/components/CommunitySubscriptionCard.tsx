import { SubscriptionPanel } from './SubscriptionPanel'
import { TrialNotice } from './TrialNotice'

interface CommunitySubscriptionCardProps {
  communityId: string
}

export function CommunitySubscriptionCard({ communityId }: CommunitySubscriptionCardProps) {
  return (
    <section className="community-card community-card--quiet">
      <h3>Assinatura desta comunidade</h3>
      <TrialNotice />
      <SubscriptionPanel subject="community" communityId={communityId} />
    </section>
  )
}
