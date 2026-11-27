// Período grátis da membro (espelha public.member_trial_length no banco): 21 dias para quem entra até
// 31/12/2026 23:59:59 (Brasília); a partir de 01/01/2027, 7 dias.
export const TRIAL_RULE_CHANGES_AT = '2027-01-01T00:00:00-03:00'

export function memberTrialDays(now: Date = new Date()): number {
  return now.getTime() < Date.parse(TRIAL_RULE_CHANGES_AT) ? 21 : 7
}
