import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AddMemberResult } from '../types/community'

interface AddMemberFormProps {
  onAdd: (email: string) => Promise<AddMemberResult>
}

export function AddMemberForm({ onAdd }: AddMemberFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await onAdd(email)

    setLoading(false)

    switch (result.status) {
      case 'success':
        setMessage({
          type: 'success',
          text: `${result.fullName ?? 'Participante'} foi adicionada à comunidade.`,
        })
        setEmail('')
        break
      case 'already_member':
        setMessage({ type: 'error', text: 'Essa mulher já faz parte desta comunidade.' })
        break
      case 'not_found':
        setMessage({
          type: 'error',
          text: 'Não encontramos nenhuma conta com esse e-mail no Círcula.',
        })
        break
      case 'error':
        setMessage({ type: 'error', text: 'Não foi possível adicionar agora. Tente novamente.' })
        break
    }
  }

  return (
    <section className="community-card">
      <h3>Adicionar mulher</h3>

      <form onSubmit={handleSubmit}>
        <label htmlFor="member-email">E-mail</label>
        <input
          id="member-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {message && (
          <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
            {message.text}
          </p>
        )}

        <button type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Buscando...' : 'Adicionar'}
        </button>
      </form>
    </section>
  )
}
