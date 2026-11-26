import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { CIRCULA_MONTHLY_CENTS, formatBrl } from '../lib/plansCatalog'
import { trialWarningTitle, type TrialWarning } from './HomeTrialBanner'

// Banner do fim do período grátis: aparece a CADA entrada no app, depois da frase do dia, quando
// faltam 3 dias ou menos. Fechar esconde só até a próxima entrada (não guarda nada no aparelho).

interface TrialReminderProps {
  warning: TrialWarning | null
  /** A frase do dia já saiu de cena e nenhum outro modal está aberto. */
  ready: boolean
  onGo: () => void
}

export function TrialReminder({ warning, ready, onGo }: TrialReminderProps) {
  const [dismissed, setDismissed] = useState(false)
  if (!warning || !ready || dismissed) return null

  return createPortal(
    <aside className="trial-reminder" role="dialog" aria-label="Período grátis">
      <span className="trial-reminder-mark" aria-hidden="true">
        ✿
      </span>
      <div className="trial-reminder-text">
        <strong>{trialWarningTitle(warning)}</strong>
        <span>Continue no Círcula por {formatBrl(CIRCULA_MONTHLY_CENTS)} por mês, com desconto nos planos de 6 e 12 meses.</span>
      </div>
      <button
        type="button"
        className="trial-reminder-go"
        onClick={() => {
          setDismissed(true)
          onGo()
        }}
      >
        Assinar
      </button>
      <button type="button" className="trial-reminder-close" onClick={() => setDismissed(true)} aria-label="Fechar aviso">
        <CloseIcon size={14} />
      </button>
    </aside>,
    document.body,
  )
}
