import { useState } from 'react'
import type { FormEvent } from 'react'
import type { InviteMemberResult } from '../types/community'

interface InviteMemberFormProps {
  onInvite: (email: string, fullName: string) => Promise<InviteMemberResult>
}

// Fase 14.2 — form da Professional para convidar uma participante que
// ainda NÃO tem conta no Círcula. Fica ao lado do `AddMemberForm` (que
// continua servindo para quem já tem conta). Toda a lógica privilegiada
// está na Edge Function `invite-member`.
export function InviteMemberForm({ onInvite }: InviteMemberFormProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await onInvite(email.trim(), fullName.trim())

    setLoading(false)

    switch (result.status) {
      case 'invited':
        setMessage({ type: 'success', text: 'Convite enviado.' })
        setEmail('')
        setFullName('')
        break
      case 'added_existing':
        setMessage({
          type: 'success',
          text: `${result.fullName ?? 'Essa pessoa'} já tinha conta no Círcula e foi adicionada à comunidade.`,
        })
        setEmail('')
        setFullName('')
        break
      case 'already_member':
        setMessage({ type: 'error', text: 'Essa pessoa já faz parte desta comunidade.' })
        break
      case 'error':
        setMessage({ type: 'error', text: result.error })
        break
    }
  }

  return (
    <section className="community-card">
      <h3>Convidar nova participante</h3>
      <p className="challenge-field-hint">
        Para quem ainda não tem conta no Círcula. Ela recebe um e-mail para
        definir a senha e já entra nesta comunidade.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="invite-email">E-mail</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          required
        />

        <label htmlFor="invite-name">Nome (opcional)</label>
        <input
          id="invite-name"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="off"
        />

        {message && (
          <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
            {message.text}
          </p>
        )}

        <button type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Enviando...' : 'Enviar convite'}
        </button>
      </form>
    </section>
  )
}
