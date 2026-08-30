import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import circulaIcon from '../assets/circula-icon.jpg'
import circulaLogo from '../assets/circula-logo.jpg'

const RESET_PASSWORD_REDIRECT_TO = 'http://localhost:5173/'
const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.'
const FORGOT_PASSWORD_ERROR_MESSAGE =
  'Não foi possível enviar o e-mail de recuperação agora. Tente novamente em alguns minutos.'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'login' | 'forgot-password'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
    }
  }

  function handleShowForgotPassword() {
    setMode('forgot-password')
    setForgotEmail(email)
    setForgotError(null)
    setForgotSuccess(false)
  }

  function handleBackToLogin() {
    setMode('login')
    setForgotError(null)
    setForgotSuccess(false)
  }

  async function handleForgotPasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setForgotLoading(true)
    setForgotError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail,
      { redirectTo: RESET_PASSWORD_REDIRECT_TO },
    )

    setForgotLoading(false)

    if (resetError) {
      setForgotError(FORGOT_PASSWORD_ERROR_MESSAGE)
      return
    }

    setForgotSuccess(true)
  }

  if (mode === 'forgot-password') {
    return (
      <section className="auth-card">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <h1>Círcula</h1>
        </div>
        <p className="auth-subtitle">Recuperar senha</p>

        {forgotSuccess ? (
          <>
            <p>{FORGOT_PASSWORD_GENERIC_MESSAGE}</p>
            <button type="button" onClick={handleBackToLogin}>
              Voltar para o login
            </button>
          </>
        ) : (
          <form onSubmit={handleForgotPasswordSubmit}>
            <label htmlFor="forgot-email">E-mail</label>
            <input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              autoComplete="email"
              required
            />

            {forgotError && <p className="auth-error">{forgotError}</p>}

            <button type="submit" disabled={forgotLoading}>
              {forgotLoading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>

            <button
              type="button"
              className="auth-link"
              onClick={handleBackToLogin}
            >
              Voltar para o login
            </button>
          </form>
        )}
      </section>
    )
  }

  return (
    <section className="auth-card">
      <img src={circulaLogo} alt="Círcula" className="brand-logo" />
      <p className="auth-subtitle">Entre com sua conta</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        <button
          type="button"
          className="auth-link"
          onClick={handleShowForgotPassword}
        >
          Esqueci minha senha
        </button>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
