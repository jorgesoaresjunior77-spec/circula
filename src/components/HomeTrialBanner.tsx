import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useSubscription } from '../hooks/useSubscription'
import { CIRCULA_MONTHLY_CENTS, formatBrl } from '../lib/plansCatalog'

// Aviso no topo da Home quando o período grátis de 21 dias está acabando (7
// dias ou menos) ou já acabou: avisa quantos dias faltam e leva à assinatura.

const MS_PER_DAY = 24 * 60 * 60 * 1000
export const TRIAL_WARNING_DAYS = 7

/** Dias inteiros que faltam até a data (0 = hoje/já passou). */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / MS_PER_DAY))
}

/** Devolve o aviso a mostrar, ou null quando não há o que avisar. */
export function trialBannerState(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  now: number = Date.now(),
): { kind: 'ending'; days: number } | { kind: 'expired' } | null {
  if (status !== 'trial') return null
  const days = trialDaysLeft(trialEndsAt, now)
  if (days === null) return null
  if (new Date(trialEndsAt as string).getTime() <= now) return { kind: 'expired' }
  return days <= TRIAL_WARNING_DAYS ? { kind: 'ending', days } : null
}

export function HomeTrialBanner({ communityId, onOpen }: { communityId: string; onOpen: () => void }) {
  const { subscription } = useSubscription({ subject: 'community', communityId })
  const state = trialBannerState(subscription?.status, subscription?.trial_ends_at)
  if (!state) return null

  const price = formatBrl(CIRCULA_MONTHLY_CENTS)
  return (
    <m.section className="home-plans-notice-wrap home-trial-banner" {...inViewOnce} variants={riseVariants} aria-label="Período grátis">
      <button type="button" className="home-plans-notice" onClick={onOpen}>
        <span className="home-plans-notice-text">
          <strong>
            {state.kind === 'expired'
              ? 'Seu período grátis terminou'
              : state.days <= 1
                ? 'Seu período grátis termina hoje ou amanhã'
                : `Faltam ${state.days} dias do seu período grátis`}
          </strong>
          <span>Continue no Círcula por {price} por mês, com desconto nos planos de 6 e 12 meses.</span>
        </span>
        <span className="home-plans-notice-cta" aria-hidden="true">
          Assinar
        </span>
      </button>
    </m.section>
  )
}
