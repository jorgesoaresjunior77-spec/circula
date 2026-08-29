import { SubscriptionPanel } from './SubscriptionPanel'

interface CommunityAccessBlockedCardProps {
  communityId: string
}

export function CommunityAccessBlockedCard({ communityId }: CommunityAccessBlockedCardProps) {
  return (
    <section className="community-card">
      <h3>Acesso a esta comunidade bloqueado</h3>
      <p className="auth-subtitle">Assinatura pendente de regularização</p>
      <p>
        Sua assinatura desta comunidade está pendente de regularização. Assine novamente para voltar a
        acessar o conteúdo normalmente — nenhum dado da comunidade foi apagado.
      </p>

      <SubscriptionPanel subject="community" communityId={communityId} />
    </section>
  )
}
