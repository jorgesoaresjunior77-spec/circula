import { useState } from 'react'
import { SO_MULHERES_MESSAGE, genderHint } from '../lib/genderCheck'
import { createPortal } from 'react-dom'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { EMAIL_NOT_CONFIRMED_MESSAGE, signInErrorMessage } from '../lib/authErrors'
import { LOGIN_PHONE_EXAMPLE, LOGIN_PHONE_HINT, normalizeLoginPhone } from '../lib/phone'
import { requestPasswordResetByPhone, rememberCredentials, signInWithPhone } from '../lib/phoneLogin'
import { PasswordInput } from './PasswordInput'
import { ConsentCheckbox, consentMetadata } from './ConsentCheckbox'
import circulaIcon from '../assets/circula-icon.png'
import loginFundo from '../assets/login-fundo.webp'
import loginLogo from '../assets/login-logo.png'

// Foto da entrada: a mesma da referência (a moça tocando o círculo brilhante). Fica fixa no app: não há onde trocar.
// O logo é um arquivo nítido (alta resolução) posto por cima do círculo, no lugar do que vinha pintado na foto,
// e os campos e botões são desenhados por cima, nas mesmas posições da referência.
// Anel brilhante que a moça toca, desenhado em vetor por cima do anel da foto (que é de baixa resolução):
// nítido em qualquer tela. Coordenadas na grade da foto (720 x 1280).
function LoginRing() {
  return (
    <svg className="login-ring" viewBox="0 0 720 1280" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="lr-g1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id="lr-g2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="lr-g3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.6" /></filter>
        <radialGradient id="lr-tip" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffe2b8" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#ffb066" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff9a40" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none">
        <circle cx="359" cy="476" r="132.5" stroke="#ff9d4d" strokeOpacity="0.55" strokeWidth="26" filter="url(#lr-g1)" />
        <circle cx="359" cy="476" r="132.5" stroke="#ffb878" strokeOpacity="0.9" strokeWidth="13" filter="url(#lr-g2)" />
        <circle cx="359" cy="476" r="132.5" stroke="#fff3df" strokeWidth="5" filter="url(#lr-g3)" />
        <circle cx="359" cy="476" r="132.5" stroke="#ffffff" strokeWidth="1.6" />
      </g>
      <circle cx="359" cy="506" r="44" fill="url(#lr-tip)" />
    </svg>
  )
}

function AuthStage({ children, form = false }: { children: React.ReactNode; form?: boolean }) {
  // No <body>: nenhum ancestral com transform prende o fundo fixo.
  return createPortal(
    <div className={`auth-stage${form ? ' auth-stage--form' : ''}`}>
      <div className="login-photo" aria-hidden="true">
        <img className="login-photo-img" src={loginFundo} alt="" decoding="async" draggable={false} />
        <LoginRing />
        {!form && <img className="login-logo" src={loginLogo} alt="" width={2112} height={708} decoding="async" draggable={false} />}
      </div>
      {children}
    </div>,
    document.body,
  )
}

// Fase 14.1 — deriva a URL do próprio ambiente/base da app: em dev
// resolve para http://localhost:5173/circula/ e em produção para
// https://jorgesoaresjunior77-spec.github.io/circula/ (base '/circula/'
// definida no vite.config.ts). Usado tanto no link de recuperação de
// senha (14.1) quanto no e-mail de confirmação do cadastro (15.1).
const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`
const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'Se este cadastro existir, você receberá um link de recuperação no e-mail da conta em instantes.'
const SIGNUP_PHONE_MESSAGE = `Informe o celular com DDD e 9, só números. Ex.: ${LOGIN_PHONE_EXAMPLE}.`
const FORGOT_PASSWORD_ERROR_MESSAGE =
  'Não foi possível enviar o e-mail de recuperação agora. Tente novamente em alguns minutos.'
const SIGNUP_MIN_PASSWORD = 6

export function Login() {
  // O login é o celular. "Entrar com e-mail" existe só para contas antigas
  // que ainda não cadastraram celular.
  const [useEmail, setUseEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
  const [signupPhone, setSignupPhone] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupAccepted, setSignupAccepted] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupNeedsConfirmation, setSignupNeedsConfirmation] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (useEmail) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(signInErrorMessage(signInError))
        setLoading(false)
        return
      }
      void rememberCredentials(email.trim(), password)
      return
    }

    const { error: phoneError } = await signInWithPhone(phone, password)
    if (phoneError) {
      setError(phoneError.code === 'email_not_confirmed' ? EMAIL_NOT_CONFIRMED_MESSAGE : phoneError.message)
      setLoading(false)
    }
  }

  function handleShowForgotPassword() {
    setMode('forgot-password')
    setForgotEmail(useEmail ? email : phone)
    setForgotError(null)
    setForgotSuccess(false)
  }

  function handleShowSignUp() {
    setMode('signup')
    setSignupEmail(useEmail ? email : '')
    setSignupPhone(useEmail ? '' : phone)
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

    // Celular (padrão) ou e-mail: o link sempre vai para o e-mail da conta.
    const typed = forgotEmail.trim()
    const failed = typed.includes('@')
      ? !!(await supabase.auth.resetPasswordForEmail(typed, { redirectTo: APP_URL })).error
      : (await requestPasswordResetByPhone(typed)).error

    setForgotLoading(false)

    if (failed) {
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
    // Círcula é só para mulheres (o servidor também barra).
    if (genderHint(signupName, signupEmail) === 'male') {
      setSignupError(SO_MULHERES_MESSAGE)
      return
    }
    const signupPhoneDigits = normalizeLoginPhone(signupPhone)
    if (!signupPhoneDigits) {
      setSignupError(SIGNUP_PHONE_MESSAGE)
      return
    }
    if (!signupAccepted) {
      setSignupError('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.')
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
        data: { full_name: signupName.trim(), account_type: 'professional', phone: signupPhoneDigits, ...consentMetadata() },
        emailRedirectTo: APP_URL,
      },
    })

    setSignupLoading(false)

    if (signUpError) {
      setSignupError(/so_mulheres/.test(signUpError.message ?? '') ? SO_MULHERES_MESSAGE : 'Não foi possível criar a conta agora. Tente novamente.')
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
      <AuthStage form>
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
              <label htmlFor="forgot-email">Celular</label>
              <input
                id="forgot-email"
                type="text"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                autoComplete="username"
                placeholder=""
                required
              />
              <p className="auth-hint">O link vai para o e-mail do seu cadastro.</p>
  
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
      </AuthStage>
    )
  }

  if (mode === 'signup') {
    return (
      <AuthStage form>
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
  
              <label htmlFor="signup-phone">Celular (será o seu login)</label>
              <input
                id="signup-phone"
                type="tel"
                inputMode="numeric"
                value={signupPhone}
                onChange={(event) => setSignupPhone(event.target.value)}
                autoComplete="username"
                placeholder=""
                required
              />
              <p className="auth-hint">{LOGIN_PHONE_HINT}</p>
  
              <label htmlFor="signup-email">E-mail (para o seu cadastro)</label>
              <input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                autoComplete="email"
                required
              />
  
              <label htmlFor="signup-password">Senha</label>
              <PasswordInput
                id="signup-password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
  
              <ConsentCheckbox id="signup-consent" checked={signupAccepted} onChange={setSignupAccepted} />
  
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
      </AuthStage>
    )
  }

  return (
    <AuthStage>
      <section className="auth-card">
        <h1 className="login-sr">Círcula</h1>
  
        <form onSubmit={handleSubmit}>
          {useEmail ? (
            <>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </>
          ) : (
            <>
              <label htmlFor="phone">Celular</label>
              <input
                id="phone"
                name="username"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="username"
                placeholder=""
                required
              />
              <p className="auth-hint">{LOGIN_PHONE_HINT}</p>
            </>
          )}
  
          <label htmlFor="password">Senha</label>
          <PasswordInput
            id="password"
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
  
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setUseEmail((v) => !v)
              setError(null)
            }}
          >
            {useEmail ? 'Entrar com o celular' : 'Entrar com e-mail'}
          </button>
        </form>
      </section>
    </AuthStage>
  )
}
