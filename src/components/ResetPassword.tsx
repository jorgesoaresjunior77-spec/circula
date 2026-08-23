import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import circulaIcon from '../assets/circula-icon.png'

export function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    await supabase.auth.signOut()
  }

  if (success) {
    return (
      <section className="auth-card">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <h1>Círcula</h1>
        </div>
        <p>Senha atualizada com sucesso.</p>
        <button type="button" onClick={handleBackToLogin}>
          Voltar para o login
        </button>
      </section>
    )
  }

  return (
    <section className="auth-card">
      <div className="brand">
        <img src={circulaIcon} alt="" className="brand-icon" />
        <h1>Círcula</h1>
      </div>
      <p className="auth-subtitle">Criar nova senha</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="new-password">Nova senha</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirm-password">Confirmar nova senha</label>
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
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </section>
  )
}
