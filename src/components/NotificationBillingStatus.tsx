import { useSubscription } from '../hooks/useSubscription'

// D1 — status de cobrança da plataforma dentro do painel de
// notificações (antes era um banner fixo em toda tela que não fosse a
// Home). MESMA fonte de dado e MESMA condição de exibição que o antigo
// <PlatformTrialBanner> (useSubscription({subject:'platform'}) +
// calculate_subscription_state), só reposicionado — nenhuma regra de
// cobrança nova. Clicar leva a Painel → Assinatura, onde o
// <SubscriptionPanel> completo (com o CTA de regularizar) já vive.

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY))
}

const SURFACED_STATES = ['trial', 'trial_ending', 'trial_expired', 'past_due']

interface NotificationBillingStatusProps {
  onActivate: () => void
}

export function NotificationBillingStatus({ onActivate }: NotificationBillingStatusProps) {
  const { subscription, calculatedState, loading } = useSubscription({ subject: 'platform' })

  if (loading || !subscription) return null

  const state = calculatedState ?? subscription.status
  if (!SURFACED_STATES.includes(state)) return null

  const remaining = daysUntil(subscription.trial_ends_at)
  const dayLabel = remaining === 1 ? 'dia' : 'dias'

  let headline: string
  let tone: 'info' | 'warn'

  if (state === 'trial') {
    headline =
      remaining <= 1
        ? 'Seu período de teste termina amanhã.'
        : `Você está no período de teste — faltam ${remaining} ${dayLabel}.`
    tone = 'info'
  } else if (state === 'trial_ending') {
    headline =
      remaining <= 0
        ? 'Seu período de teste termina hoje.'
        : `Seu período de teste está terminando — falta${remaining === 1 ? '' : 'm'} ${remaining} ${dayLabel}.`
    tone = 'warn'
  } else if (state === 'trial_expired') {
    headline = 'Seu período de teste terminou. Assine para manter o acesso à plataforma.'
    tone = 'warn'
  } else {
    headline = 'Há um pagamento da sua assinatura pendente de regularização.'
    tone = 'warn'
  }

  return (
    <button
      type="button"
      className={`notification-item notification-item--billing notification-item--billing-${tone}`}
      onClick={onActivate}
    >
      <span className="notification-body">
        <span className="notification-title">{headline}</span>
        <span className="notification-text">Toque para ver sua assinatura.</span>
      </span>
    </button>
  )
}
