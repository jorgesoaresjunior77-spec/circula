// Regra do período grátis: 21 dias para usar todas as ferramentas. Faltando 3 dias, o sino avisa
// e um banner aparece a cada entrada no app, depois da frase do dia (ver TrialReminder e NotificationBell).

const MS_PER_DAY = 24 * 60 * 60 * 1000
export const TRIAL_DAYS = 21
export const TRIAL_WARNING_DAYS = 3

/** Dias inteiros que faltam até a data (0 = hoje/já passou). */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / MS_PER_DAY))
}

export type TrialWarning = { kind: 'ending'; days: number } | { kind: 'expired' }

/** Devolve o aviso a mostrar, ou null quando não há o que avisar. */
export function trialBannerState(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  now: number = Date.now(),
): TrialWarning | null {
  if (status !== 'trial') return null
  const days = trialDaysLeft(trialEndsAt, now)
  if (days === null) return null
  if (new Date(trialEndsAt as string).getTime() <= now) return { kind: 'expired' }
  return days <= TRIAL_WARNING_DAYS ? { kind: 'ending', days } : null
}

/** Título curto do aviso, o mesmo no banner e no sino. */
export function trialWarningTitle(w: TrialWarning): string {
  if (w.kind === 'expired') return 'Seu período grátis terminou'
  if (w.days <= 1) return 'Seu período grátis termina hoje ou amanhã'
  return `Faltam ${w.days} dias do seu período grátis`
}
