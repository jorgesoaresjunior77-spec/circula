import { useMyPackages } from '../hooks/usePackageAccess'
import { useSubscription } from '../hooks/useSubscription'
import { ownedProductNames, subscriptionLevel } from '../lib/subscriptionLevel'

// Assinatura atual da membro (Meu perfil e página de Planos): o plano, a situação, até quando vale
// e os conteúdos que ela tem.
const STATE_TEXT: Record<string, string> = {
  active: 'Ativa',
  renewing_soon: 'Ativa, renova em breve',
  trial: 'Período de teste',
  trial_ending: 'Período de teste terminando',
  past_due: 'Pagamento em aberto',
  trial_expired: 'Teste encerrado',
  blocked: 'Bloqueada por falta de pagamento',
  canceled: 'Cancelada',
}

function brDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function SubscriptionLevelCard({ communityId, profileId }: { communityId: string; profileId: string }) {
  const { packages, loading } = useMyPackages(communityId, profileId, true)
  const { subscription, calculatedState, loading: subLoading } = useSubscription({ subject: 'community', communityId })

  if (loading || subLoading) return <p className="home-muted">Carregando seu plano…</p>

  const state = calculatedState ?? subscription?.status ?? null
  const level = subscriptionLevel(packages, state)
  const products = ownedProductNames(packages)
  const until = brDate(subscription?.current_period_end ?? null)
  const trialUntil = brDate(subscription?.trial_ends_at ?? null)
  const inTrial = state === 'trial' || state === 'trial_ending'

  return (
    <section className="sub-level" aria-label="Nível da assinatura">
      <p className="sub-level-eyebrow">Seu nível</p>
      <h3 className={`sub-level-name sub-level-name--${level.id}`}>{level.label}</h3>
      <p className="sub-level-hint">{level.hint}</p>
      <dl className="sub-level-facts">
        <div>
          <dt>Assinatura atual</dt>
          <dd>{level.label}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>{state ? (STATE_TEXT[state] ?? state) : 'Sem assinatura ativa'}</dd>
        </div>
        {(inTrial ? trialUntil : until) && (
          <div>
            <dt>{inTrial ? 'Teste até' : 'Vale até'}</dt>
            <dd>{inTrial ? trialUntil : until}</dd>
          </div>
        )}
      </dl>
      {products.length > 0 && (
        <ul className="sub-level-products" aria-label="Conteúdos que você tem">
          {products.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
