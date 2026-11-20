import { useMyPackages } from '../hooks/usePackageAccess'
import { useSubscription } from '../hooks/useSubscription'
import { subscriptionLevel } from '../lib/subscriptionLevel'

// Nível da assinatura e produtos da membro (Meu perfil e página de Planos).
export function SubscriptionLevelCard({ communityId, profileId }: { communityId: string; profileId: string }) {
  const { packages, loading } = useMyPackages(communityId, profileId, true)
  const { subscription, calculatedState, loading: subLoading } = useSubscription({ subject: 'community', communityId })

  if (loading || subLoading) return <p className="home-muted">Carregando seu plano…</p>

  const level = subscriptionLevel(packages, calculatedState ?? subscription?.status)

  return (
    <section className="sub-level" aria-label="Nível da assinatura">
      <p className="sub-level-eyebrow">Seu nível</p>
      <h3 className={`sub-level-name sub-level-name--${level.id}`}>{level.label}</h3>
      <p className="sub-level-hint">{level.hint}</p>
    </section>
  )
}
