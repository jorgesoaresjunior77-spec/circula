import { useState } from 'react'
import type { FormEvent } from 'react'
import { useProfessionalBillingAccount } from '../hooks/useProfessionalBillingAccount'

// =====================================================================
// FASE 16.1 — "Conectar conta Asaas para receber pagamentos"
// =====================================================================
// Passo de onboarding financeiro da Professional. Mostra o formulário
// de conexão enquanto não há vínculo verificado; depois mostra o
// estado conectado + "Desconectar".
//
// A chave de API digitada:
//   - vai SOMENTE para a Edge Function `connect-asaas-account` (HTTPS);
//   - fica num state local efêmero, limpo assim que a submissão termina;
//   - nunca é logada, nunca é persistida, nunca volta na resposta.
// O componente só LÊ a própria linha de `professional_billing_accounts`
// (via RLS). Nenhum service_role, nenhuma credencial Asaas no bundle.
// =====================================================================

interface AsaasAccountConnectProps {
  /** Só faz sentido para a anfitriã (role='professional' com comunidade). */
  enabled: boolean
}

export function AsaasAccountConnect({ enabled }: AsaasAccountConnectProps) {
  const { account, connected, loading, connect, disconnect } = useProfessionalBillingAccount(enabled)

  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  if (!enabled) return null
  if (loading) return <p>Carregando conta de recebimento...</p>

  async function handleConnect(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)

    const { error } = await connect(apiKey.trim())

    // Limpa a chave da memória do componente independentemente do resultado.
    setApiKey('')
    setBusy(false)

    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }
    setMessage({ type: 'success', text: 'Conta Asaas conectada e verificada.' })
  }

  async function handleDisconnect() {
    setBusy(true)
    setMessage(null)

    const { error } = await disconnect()

    setBusy(false)
    setConfirmingDisconnect(false)

    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }
    setMessage({ type: 'success', text: 'Conta Asaas desconectada.' })
  }

  return (
    <section className="community-card community-card--quiet asaas-connect">
      <p className="section-label">Conta de recebimento (Asaas)</p>

      {message && (
        <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>{message.text}</p>
      )}

      {connected ? (
        <>
          <p>
            Conectada
            {account?.asaas_account_name ? (
              <>
                {' '}— <strong>{account.asaas_account_name}</strong>
              </>
            ) : null}
            .
          </p>
          {account?.asaas_account_status && account.asaas_account_status !== 'APPROVED' && (
            <p className="auth-error">
              Situação cadastral na Asaas: {account.asaas_account_status}. Conclua a verificação na
              Asaas para receber sem bloqueios.
            </p>
          )}
          {confirmingDisconnect ? (
            <div className="question-item-actions">
              <button type="button" className="question-delete-button" onClick={handleDisconnect} disabled={busy}>
                {busy ? 'Desconectando...' : 'Confirmar desconexão'}
              </button>
              <button type="button" onClick={() => setConfirmingDisconnect(false)} disabled={busy}>
                Cancelar
              </button>
            </div>
          ) : (
            <div className="question-item-actions">
              <button
                type="button"
                className="question-delete-button"
                onClick={() => setConfirmingDisconnect(true)}
              >
                Desconectar conta Asaas
              </button>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleConnect} className="question-form">
          <p>
            Conecte a conta Asaas que <strong>você mesma</strong> criou para receber os pagamentos das
            participantes. Ela precisa estar registrada no mesmo CPF/CNPJ que você cadastrou aqui.
          </p>
          <p>
            No painel da Asaas, vá em <strong>Integrações</strong> e gere uma chave de API. Cole abaixo —
            usamos só uma vez para confirmar a titularidade e ler o identificador da sua carteira. A chave
            não é armazenada.
          </p>

          <label htmlFor="asaas-api-key">Chave de API da sua conta Asaas</label>
          <input
            id="asaas-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="$aact_..."
            required
          />

          <button type="submit" disabled={busy || apiKey.trim().length < 20}>
            {busy ? 'Conectando...' : 'Conectar conta Asaas'}
          </button>
        </form>
      )}
    </section>
  )
}
