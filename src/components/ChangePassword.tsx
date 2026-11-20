import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { evaluatePassword, isPasswordValid } from '../lib/passwordPolicy'
import { PasswordInput } from './PasswordInput'

// "Minha senha" no perfil: a pessoa troca a senha (por exemplo, depois de entrar
// com a senha provisória que recebeu). Mesmas regras de senha do cadastro.

export function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const rules = evaluatePassword(password)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!isPasswordValid(password)) return setMessage({ ok: false, text: 'A senha ainda não atende todos os requisitos abaixo.' })
    if (password !== confirm) return setMessage({ ok: false, text: 'As duas senhas precisam ser iguais.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: 'Não foi possível trocar a senha agora. Entre de novo e tente outra vez.' })
    setPassword('')
    setConfirm('')
    setMessage({ ok: true, text: 'Senha alterada. Use a nova senha na próxima vez que entrar.' })
  }

  return (
    <div className="profile-password-section">
      <p className="profile-section-label profile-section-label--spaced">Minha senha</p>
      {!open ? (
        <button type="button" className="profile-secondary-action" onClick={() => setOpen(true)}>
          Trocar minha senha
        </button>
      ) : (
        <form className="change-password" onSubmit={(e) => void submit(e)}>
          <label>
            Nova senha
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <ul className="member-signup-rules">
            {rules.map((r) => (
              <li key={r.id} className={`member-signup-rule${r.met ? ' member-signup-rule--met' : ''}`}>
                {r.met ? '✓' : '•'} {r.label}
              </li>
            ))}
          </ul>
          <label>
            Repita a nova senha
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          {message && (
            <p className={message.ok ? 'auth-success' : 'auth-error'} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          <div className="pn-actions">
            <button type="submit" className="water-primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <button type="button" className="hw-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
