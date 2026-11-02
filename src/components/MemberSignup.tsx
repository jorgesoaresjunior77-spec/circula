import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { evaluatePassword, isPasswordValid } from '../lib/passwordPolicy'
import { EMAIL_NOT_CONFIRMED_MESSAGE } from '../lib/authErrors'
import { useInvitePreview } from '../hooks/useInvitePreview'
import circulaIcon from '../assets/circula-icon.png'

// Cadastro de participante pelo link de convite da comunidade (enviado
// pela Profissional no WhatsApp). Fluxo: nome + e-mail + senha → conta →
// o App entra na comunidade com o token (join_community_by_invite) →
// onboarding → tour → app. O token fica guardado no navegador, então
// também vale se o projeto exigir confirmação de e-mail ou se a pessoa
// já tiver conta e preferir entrar.
const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`

interface MemberSignupProps {
  token: string
  /** A pessoa já tem conta: segue para o login (o token continua guardado). */
  onHaveAccount: () => void
}

export function MemberSignup({ token, onHaveAccount }: MemberSignupProps) {
  const preview = useInvitePreview(token)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const rules = evaluatePassword(password)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Informe como você gostaria de ser chamada.')
      return
    }
    if (!isPasswordValid(password)) {
      setError('A senha ainda não atende todos os requisitos abaixo.')
      return
    }

    setLoading(true)
    // Sem `account_type`: o gatilho handle_new_user cria o perfil como
    // member (só a tela de Profissional pede 'professional').
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: APP_URL },
    })
    setLoading(false)

    if (signUpError) {
      setError(
        signUpError.code === 'weak_password'
          ? 'Essa senha não foi aceita. Tente uma senha mais longa.'
          : 'Não foi possível criar a conta agora. Confira o e-mail e tente novamente.',
      )
      return
    }

    // E-mail já cadastrado: o Supabase devolve um usuário "fantasma"
    // (identities vazio) para não revelar quem tem conta.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('Este e-mail já pode ter uma conta. Use "Já tenho conta" para entrar.')
      return
    }

    // Com sessão, o App assume daqui (entra na comunidade e abre o
    // onboarding). Sem sessão, o projeto exige confirmar o e-mail.
    if (!data.session) setNeedsConfirmation(true)
  }

  return (
    <section className="auth-card member-signup">
      <div className="brand">
        <img src={circulaIcon} alt="" className="brand-icon" />
        <h1>Círcula</h1>
      </div>

      {preview.status === 'loading' && <p>Verificando seu convite…</p>}

      {preview.status === 'invalid' && (
        <>
          <p className="auth-error" role="alert">
            Este convite não está mais ativo. Peça um link novo para quem te convidou.
          </p>
          <button type="button" className="auth-link" onClick={onHaveAccount}>
            Já tenho conta
          </button>
        </>
      )}

      {preview.status === 'valid' && needsConfirmation && (
        <>
          <p className="auth-error" role="alert">
            {EMAIL_NOT_CONFIRMED_MESSAGE}
          </p>
          <p>Depois de confirmar, é só entrar e você já fará parte de {preview.communityName}.</p>
          <button type="button" onClick={onHaveAccount}>
            Ir para o login
          </button>
        </>
      )}

      {preview.status === 'valid' && !needsConfirmation && (
        <form onSubmit={handleSubmit}>
          <p className="auth-subtitle">Você foi convidada para</p>
          <h2 className="member-signup-community">{preview.communityName}</h2>
          <p>Crie seu acesso para entrar na comunidade.</p>

          <label htmlFor="member-signup-name">Como podemos te chamar?</label>
          <input
            id="member-signup-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />

          <label htmlFor="member-signup-email">E-mail (será o seu login)</label>
          <input
            id="member-signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="member-signup-password">Crie uma senha</label>
          <input
            id="member-signup-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            aria-describedby="member-signup-rules"
            required
          />
          <button type="button" className="auth-link" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          </button>

          <ul id="member-signup-rules" className="member-signup-rules">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className={`member-signup-rule${rule.met ? ' member-signup-rule--met' : ''}`}
              >
                <span aria-hidden="true">{rule.met ? '✓' : '○'}</span> {rule.label}
              </li>
            ))}
          </ul>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar minha conta'}
          </button>

          <button type="button" className="auth-link" onClick={onHaveAccount}>
            Já tenho conta
          </button>
        </form>
      )}
    </section>
  )
}
