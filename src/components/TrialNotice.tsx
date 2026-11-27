import { memberTrialDays } from '../lib/trialRule'

// Lembrete para a participante: dias grátis (21 até 31/12/2026, 7 a partir de 2027) e, depois, a assinatura.
export function TrialNotice() {
  return (
    <p className="trial-notice">
      Sua estadia é <strong>grátis por {memberTrialDays()} dias</strong>. Depois, para continuar, a assinatura do Círcula é de{' '}
      <strong>R$ 14,90 por mês</strong>, com desconto nos planos de 6 e 12 meses.
    </p>
  )
}
