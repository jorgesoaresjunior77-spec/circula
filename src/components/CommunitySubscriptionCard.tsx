import { SubscriptionPanel } from './SubscriptionPanel'

interface CommunitySubscriptionCardProps {
  communityId: string
}

export function CommunitySubscriptionCard({ communityId }: CommunitySubscriptionCardProps) {
  return (
    <section className="community-card community-card--quiet">
      <h3>Assinatura desta comunidade</h3>
      <SubscriptionPanel subject="community" communityId={communityId} />
    </section>
  )
}
