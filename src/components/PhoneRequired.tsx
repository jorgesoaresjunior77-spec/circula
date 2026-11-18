import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { LOGIN_PHONE_EXAMPLE, LOGIN_PHONE_HINT, normalizeLoginPhone } from '../lib/phone'
import circulaIcon from '../assets/circula-icon.png'

// Conta sem celular de login (conta antiga ou convite por e-mail): antes de
// seguir, a pessoa cadastra o celular, que passa a ser o login dela. O e-mail
// continua no cadastro.

export function PhoneRequired({ onSaved, onSignOut }: { onSaved: () => void; onSignOut: () => void }) {
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const digits = normalizeLoginPhone(phone)
    if (!digits) {
      setError(`Informe o celular com DDD e 9, só números. Ex.: ${LOGIN_PHONE_EXAMPLE}.`)
      return
    }
    setSaving(true)
    const { error: rpcError } = await supabase.rpc('set_my_login_phone', { p_phone: digits })
    setSaving(false)
    if (rpcError) {
      setError(
        /phone_in_use/.test(rpcError.message)
          ? 'Este celular já está em uso em outra conta.'
          : 'Não foi possível salvar o celular agora. Tente novamente.',
      )
      return
    }
    onSaved()
  }

  return (
    <section className="auth-card">
      <div className="brand">
        <img src={circulaIcon} alt="" className="brand-icon" />
        <h1>Círcula</h1>
      </div>
      <p className="auth-subtitle">Cadastre seu celular</p>

      <form onSubmit={handleSubmit}>
        <p>O seu login agora é o celular. Da próxima vez, é só entrar com ele e a sua senha.</p>

        <label htmlFor="required-phone">Celular (será o seu login)</label>
        <input
          id="required-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="username"
          placeholder={LOGIN_PHONE_EXAMPLE}
          required
        />
        <p className="auth-hint">{LOGIN_PHONE_HINT}</p>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar celular'}
        </button>
        <button type="button" className="auth-link" onClick={onSignOut}>
          Sair
        </button>
      </form>
    </section>
  )
}
