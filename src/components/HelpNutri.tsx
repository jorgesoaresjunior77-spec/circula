import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ConversationOverview } from '../types/message'
import { ConversationView } from './ConversationView'

// Help Nutri (membro): uma página simples para chamar a profissional.
// Sem busca de pessoas — a única interlocutora é a dona da comunidade.
interface HelpNutriProps {
  ownerId: string
  myProfileId: string
  conversations: ConversationOverview[]
  initialConversationId: string | null
  onConsumedInitial: () => void
  onStartConversation: (otherProfileId: string) => Promise<{ id: string | null; error: string | null }>
  onActivity: () => void
  /** Tem o pacote Help Nutri ou o plano completo. */
  hasAccess?: boolean
  /** Leva à página de Planos. */
  onOpenPlans?: () => void
}

export function HelpNutri({
  ownerId,
  myProfileId,
  conversations,
  initialConversationId,
  onConsumedInitial,
  onStartConversation,
  onActivity,
  hasAccess = true,
  onOpenPlans,
}: HelpNutriProps) {
  const [name, setName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', ownerId)
      .single()
      .then(({ data }) => {
        if (!active || !data) return
        setName(data.full_name)
        setAvatar(data.avatar_url)
      })
    return () => {
      active = false
    }
  }, [ownerId])

  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId)
      onConsumedInitial()
    }
  }, [initialConversationId, onConsumedInitial])

  const unread = conversations.reduce((n, c) => n + (c.unread_count ?? 0), 0)
  const firstName = (name ?? 'a nutricionista').split(' ')[0]

  async function start() {
    setBusy(true)
    setError(null)
    const { id, error: err } = await onStartConversation(ownerId)
    setBusy(false)
    if (err || !id) {
      setError('Não foi possível abrir a conversa agora. Tente novamente.')
      return
    }
    setConversationId(id)
  }

  if (conversationId && hasAccess) {
    return (
      <section className="messages messages--thread help-nutri-thread">
        <div className="messages-pane messages-pane--detail">
          <ConversationView
            key={conversationId}
            conversationId={conversationId}
            myProfileId={myProfileId}
            peer={{ id: ownerId, full_name: name, avatar_url: avatar }}
            onBack={() => setConversationId(null)}
            onActivity={onActivity}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="help-nutri">
      {avatar && <img className="help-nutri-avatar" src={avatar} alt="" loading="lazy" decoding="async" />}
      <h2 className="help-nutri-title">Help Nutri</h2>
      {hasAccess ? (
        <>
          <button type="button" className="help-nutri-btn" onClick={() => void start()} disabled={busy}>
            {busy ? 'Abrindo...' : `Chamar ${firstName}`}
            {unread > 0 && <span className="help-nutri-badge">{unread}</span>}
          </button>
          <p className="help-nutri-sub">Toque para falar direto com {name ?? 'a nutricionista'}.</p>
        </>
      ) : (
        <>
          <p className="help-nutri-sub">
            O Help Nutri é para quem tem o pacote Help Nutri ou o plano completo. Com ele, você chama{' '}
            {name ?? 'a nutricionista'} direto pelo app.
          </p>
          {onOpenPlans && (
            <button type="button" className="help-nutri-btn" onClick={onOpenPlans}>
              Ver planos
            </button>
          )}
        </>
      )}
      {error && <p className="auth-error">{error}</p>}
    </section>
  )
}
