import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import circulaIcon from '../assets/circula-icon.jpg'
import circulaLogo from '../assets/circula-logo.jpg'

// Fase 14.1 — deriva a URL do próprio ambiente/base da app: em dev
// resolve para http://localhost:5173/circula/ e em produção para
// https://jorgesoaresjunior77-spec.github.io/circula/ (base '/circula/'
// definida no vite.config.ts). Usado tanto no link de recuperação de
// senha (14.1) quanto no e-mail de confirmação do cadastro (15.1).
const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`
const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.'
const FORGOT_PASSWORD_ERROR_MESSAGE =
  'Não foi possível enviar o e-mail de recuperação agora. Tente novamente em alguns minutos.'
const SIGNUP_MIN_PASSWORD = 6

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'login' | 'forgot-password' | 'signup'>('login')

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // Fase 15.1 — cadastro público de profissional.
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupNeedsConfirmation, setSignupNeedsConfirmation] = useState(false)

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

  function handleShowSignUp() {
    setMode('signup')
    setSignupEmail(email)
    setSignupError(null)
    setSignupNeedsConfirmation(false)
  }

  function handleBackToLogin() {
    setMode('login')
    setForgotError(null)
    setForgotSuccess(false)
    setSignupError(null)
    setSignupNeedsConfirmation(false)
  }

  async function handleForgotPasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setForgotLoading(true)
    setForgotError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail,
      { redirectTo: APP_URL },
    )

    setForgotLoading(false)

    if (resetError) {
      setForgotError(FORGOT_PASSWORD_ERROR_MESSAGE)
      return
    }

    setForgotSuccess(true)
  }

  async function handleSignUpSubmit(event: FormEvent) {
    event.preventDefault()
    setSignupError(null)

    if (!signupName.trim()) {
      setSignupError('Informe seu nome.')
      return
    }
    if (signupPassword.length < SIGNUP_MIN_PASSWORD) {
      setSignupError(`A senha precisa ter pelo menos ${SIGNUP_MIN_PASSWORD} caracteres.`)
      return
    }

    setSignupLoading(true)

    // `account_type: 'professional'` é lido pelo trigger `handle_new_user`
    // (Fase 15.1): o perfil nasce professional e ganha um trial de
    // plataforma de 21 dias. O trigger NUNCA cria 'master'.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: { full_name: signupName.trim(), account_type: 'professional' },
        emailRedirectTo: APP_URL,
      },
    })

    setSignupLoading(false)

    if (signUpError) {
      setSignupError('Não foi possível criar a conta agora. Tente novamente.')
      return
    }

    // E-mail já cadastrado: o Supabase devolve um user "fantasma" com
    // `identities` vazio (proteção contra enumeração). Mensagem neutra.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setSignupError(
        'Este e-mail já pode ter uma conta. Tente entrar ou usar "Esqueci minha senha".',
      )
      return
    }

    // Sem sessão => o projeto exige confirmação de e-mail.
    // Com sessão => o App já troca para o Dashboard (que roteia a
    // profissional sem comunidade para "Crie sua comunidade").
    if (!data.session) {
      setSignupNeedsConfirmation(true)
    }
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

  if (mode === 'signup') {
    return (
      <section className="auth-card">
        <div className="brand">
          <img src={circulaIcon} alt="" className="brand-icon" />
          <h1>Círcula</h1>
        </div>
        <p className="auth-subtitle">Criar conta de profissional</p>

        {signupNeedsConfirmation ? (
          <>
            <p>
              Conta criada. Enviamos um e-mail para você confirmar o endereço —
              depois disso é só entrar.
            </p>
            <button type="button" onClick={handleBackToLogin}>
              Voltar para o login
            </button>
          </>
        ) : (
          <form onSubmit={handleSignUpSubmit}>
            <p>
              Crie sua conta para montar a comunidade que você acompanha. Você
              começa com 21 dias de teste.
            </p>

            <label htmlFor="signup-name">Nome</label>
            <input
              id="signup-name"
              type="text"
              value={signupName}
              onChange={(event) => setSignupName(event.target.value)}
              autoComplete="name"
              required
            />

            <label htmlFor="signup-email">E-mail</label>
            <input
              id="signup-email"
              type="email"
              value={signupEmail}
              onChange={(event) => setSignupEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="signup-password">Senha</label>
            <input
              id="signup-password"
              type="password"
              value={signupPassword}
              onChange={(event) => setSignupPassword(event.target.value)}
              autoComplete="new-password"
              required
            />

            {signupError && <p className="auth-error">{signupError}</p>}

            <button type="submit" disabled={signupLoading}>
              {signupLoading ? 'Criando...' : 'Criar conta'}
            </button>

            <button type="button" className="auth-link" onClick={handleBackToLogin}>
              Já tenho conta
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

        <button type="button" className="auth-link" onClick={handleShowSignUp}>
          Criar conta de profissional
        </button>
      </form>
    </section>
  )
}
