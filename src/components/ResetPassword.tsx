import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import circulaIcon from '../assets/circula-icon.jpg'

interface ResetPasswordProps {
  /**
   * `recovery` (default): recuperação de senha (Fase 14.1) — comportamento
   * original, sucesso volta ao login.
   * `invite` (Fase 14.2): primeiro acesso de uma nova participante que
   * recebeu um convite — mesma chamada `updateUser({ password })`, mas ao
   * concluir NÃO faz signOut: a sessão do link de convite continua e a
   * Member entra no Dashboard já vinculada à comunidade.
   */
  mode?: 'recovery' | 'invite'
  /** Convite expirado/inválido — mostra só a mensagem, sem formulário. */
  invalid?: boolean
  /** `invite`: chamado após definir a senha, ou no "ir para o login" do caso inválido. */
  onDone?: () => void
}

export function ResetPassword({
  mode = 'recovery',
  invalid = false,
  onDone,
}: ResetPasswordProps = {}) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isInvite = mode === 'invite'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setLoading(false)

    if (updateError) {
      setError('Não foi possível atualizar a senha. Tente novamente.')
      return
    }

    setSuccess(true)
  }

  async function handleBackToLogin() {
    if (isInvite) {
      // No caso inválido não há sessão útil; limpa o estado e cai no login.
      onDone?.()
      return
    }
    await supabase.auth.signOut()
  }

  // Convite expirado / já utilizado -----------------------------------
  if (invalid) {
    return (
      <section className="auth-card">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <h1>Círcula</h1>
        </div>
        <p>
          Este convite expirou ou já foi utilizado. Peça um novo convite à
          responsável pela comunidade.
        </p>
        <button type="button" onClick={handleBackToLogin}>
          Ir para o login
        </button>
      </section>
    )
  }

  if (success) {
    return (
      <section className="auth-card">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <h1>Círcula</h1>
        </div>
        {isInvite ? (
          <>
            <p>Senha definida. Bem-vinda ao Círcula!</p>
            <button type="button" onClick={() => onDone?.()}>
              Entrar
            </button>
          </>
        ) : (
          <>
            <p>Senha atualizada com sucesso.</p>
            <button type="button" onClick={handleBackToLogin}>
              Voltar para o login
            </button>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="auth-card">
      <div className="brand">
        <img src={circulaIcon} alt="" className="brand-icon" />
        <h1>Círcula</h1>
      </div>
      <p className="auth-subtitle">
        {isInvite ? 'Defina sua senha de acesso' : 'Criar nova senha'}
      </p>
      {isInvite && (
        <p>É o seu primeiro acesso ao Círcula. Escolha uma senha para entrar.</p>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="new-password">{isInvite ? 'Senha' : 'Nova senha'}</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirm-password">
          {isInvite ? 'Confirmar senha' : 'Confirmar nova senha'}
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isInvite ? 'Definir senha' : 'Salvar nova senha'}
        </button>
      </form>
    </section>
  )
}
