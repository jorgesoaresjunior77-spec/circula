import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChangePassword } from './ChangePassword'

// Card "Administração" no fim do Meu perfil: senha, cancelamento das
// assinaturas e exclusão da conta. A exclusão pede que a pessoa digite a
// palavra EXCLUIR e não tem volta.

const CONFIRM_WORD = 'EXCLUIR'

export function AccountAdmin({ onOpenPlans }: { onOpenPlans?: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (typed.trim().toUpperCase() !== CONFIRM_WORD) return
    setBusy(true)
    setError(null)
    const { error: invokeError } = await supabase.functions.invoke('delete-my-account', { body: { confirm: CONFIRM_WORD } })
    if (invokeError) {
      setBusy(false)
      setError('Não foi possível excluir a conta agora. Tente de novo em instantes ou fale com a nutricionista.')
      return
    }
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <section className="account-admin" aria-label="Administração da conta">
      <p className="profile-section-label profile-section-label--spaced">Administração</p>

      <ChangePassword />

      <div className="account-admin-block">
        <p className="profile-section-label profile-section-label--spaced">Cancelar assinaturas</p>
        <p className="home-muted">
          Para cancelar o Círcula, o Premium ou um conteúdo avulso, abra o plano em Planos e assinaturas e toque em Cancelar. Você
          mantém o acesso até o fim do período já pago.
        </p>
        {onOpenPlans && (
          <button type="button" className="profile-secondary-action" onClick={onOpenPlans}>
            Abrir Planos e assinaturas
          </button>
        )}
      </div>

      <div className="account-admin-block">
        <p className="profile-section-label profile-section-label--spaced">Excluir minha conta</p>
        {!deleting ? (
          <>
            <p className="home-muted">
              Ao excluir, seu acesso termina, suas assinaturas são canceladas e seus dados pessoais são removidos. Não dá para desfazer.
            </p>
            <button type="button" className="question-delete-button" onClick={() => setDeleting(true)}>
              Excluir minha conta
            </button>
          </>
        ) : (
          <div className="account-admin-confirm">
            <p>
              Para confirmar, digite <strong>{CONFIRM_WORD}</strong> abaixo. Esta ação não pode ser desfeita.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-label={`Digite ${CONFIRM_WORD} para confirmar`}
              placeholder={CONFIRM_WORD}
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <div className="question-item-actions">
              <button
                type="button"
                className="question-delete-button"
                disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
                onClick={() => void handleDelete()}
              >
                {busy ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
              <button type="button" onClick={() => { setDeleting(false); setTyped(''); setError(null) }} disabled={busy}>
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
