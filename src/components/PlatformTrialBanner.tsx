import { useState } from 'react'
import { useSubscription } from '../hooks/useSubscription'
import { SubscriptionPanel } from './SubscriptionPanel'

// =====================================================================
// FASE 15.2 (G1) — visibilidade do trial de plataforma para o Professional
// =====================================================================
// Componente puro de leitura. Usa o MESMO `useSubscription({ subject:
// 'platform' })` que a aba "Assinaturas" já usa: cliente anon + RLS
// (`subscriptions_select` = `profile_id = auth.uid()`). NÃO usa
// service_role. NÃO envia nenhum valor financeiro — o CTA apenas revela
// o `<SubscriptionPanel>` que já existe, e é ele que chama a Edge
// Function `asaas-create-subscription` (onde o preço vem de
// `billing_plans` no servidor, nunca do cliente).
//
// Só aparece nos estados trial / trial terminando / trial encerrado /
// pagamento pendente. Assinatura ativa (ou ausência de assinatura) =>
// nada é renderizado. O bloqueio pós-trial continua tratado por
// `usePlatformAccessBlocked` -> `AccessBlockedScreen` no `App.tsx`.
// =====================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY))
}

const SURFACED_STATES = ['trial', 'trial_ending', 'trial_expired', 'past_due']

export function PlatformTrialBanner() {
  const { subscription, calculatedState, loading } = useSubscription({ subject: 'platform' })
  const [showPanel, setShowPanel] = useState(false)

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

  // Estados urgentes já abrem o painel de assinatura direto.
  const forceOpen = state === 'trial_expired' || state === 'past_due'
  const ctaLabel = state === 'past_due' ? 'Regularizar' : 'Assinar agora'

  return (
    <section className={`community-card community-card--quiet trial-banner trial-banner--${tone}`}>
      <div className="trial-banner-row">
        <p className="trial-banner-headline">{headline}</p>
        {!forceOpen && !showPanel && (
          <button type="button" className="btn btn-secondary" onClick={() => setShowPanel(true)}>
            {ctaLabel}
          </button>
        )}
      </div>

      {(forceOpen || showPanel) && <SubscriptionPanel subject="platform" />}
    </section>
  )
}
