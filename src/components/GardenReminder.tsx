import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

// Lembrete do desafio do Meu Jardim: um banner que aparece depois da frase do
// dia, enquanto a membro ainda não fez o check de hoje. Leva direto à página
// do Jardim. Fechando, não volta no mesmo dia (guardado no aparelho); a
// bolinha vermelha no cartão do Jardim continua até o check ser feito.

interface GardenReminderProps {
  /** Há desafio hoje e o check ainda não foi feito. */
  pending: boolean
  /** A frase do dia já saiu de cena e nenhum outro modal está aberto. */
  ready: boolean
  onGo: () => void
}

function todayKey(): string {
  const d = new Date()
  return `circula:garden-reminder:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(todayKey()) === '1'
  } catch {
    return false
  }
}

export function GardenReminder({ pending, ready, onGo }: GardenReminderProps) {
  const [dismissed, setDismissed] = useState(alreadyDismissed)

  if (!pending || !ready || dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(todayKey(), '1')
    } catch {
      /* sem storage: só some nesta sessão */
    }
    setDismissed(true)
  }

  return createPortal(
    <aside className="garden-reminder" role="dialog" aria-label="Desafio de hoje no Meu Jardim">
      <span className="garden-reminder-flower" aria-hidden="true">
        🌸
      </span>
      <div className="garden-reminder-text">
        <strong>Seu desafio de hoje está esperando</strong>
        <span>Passe no Meu Jardim e faça o check para acender mais uma pétala.</span>
      </div>
      <button
        type="button"
        className="garden-reminder-go"
        onClick={() => {
          dismiss()
          onGo()
        }}
      >
        Ir ao Jardim
      </button>
      <button type="button" className="garden-reminder-close" onClick={dismiss} aria-label="Fechar lembrete">
        <CloseIcon size={14} />
      </button>
    </aside>,
    document.body,
  )
}
