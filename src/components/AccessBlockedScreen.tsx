import { SubscriptionPanel } from './SubscriptionPanel'

interface AccessBlockedScreenProps {
  onSignOut: () => void
}

export function AccessBlockedScreen({ onSignOut }: AccessBlockedScreenProps) {
  return (
    <section className="auth-card">
      <h1>Círcula</h1>
      <p className="auth-subtitle">Acesso temporariamente bloqueado</p>
      <p>
        Sua assinatura com o Círcula está pendente de regularização. Assine novamente para voltar a usar o
        aplicativo normalmente — nenhum dado da sua comunidade foi apagado.
      </p>

      <SubscriptionPanel subject="platform" />

      <button type="button" className="auth-link" onClick={onSignOut}>
        Sair
      </button>
    </section>
  )
}
