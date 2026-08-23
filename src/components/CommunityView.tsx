import { useState } from 'react'
import type { CommunityWithMembers, JoinResult } from '../types/community'

interface CommunityViewProps {
  community: CommunityWithMembers
  memberCount?: number
  badge?: string
  onJoin?: () => Promise<JoinResult>
}

export function CommunityView({ community, memberCount, badge, onJoin }: CommunityViewProps) {
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  async function handleJoin() {
    if (!onJoin) return

    setJoining(true)
    setMessage(null)

    const result = await onJoin()

    setJoining(false)

    if (result.status === 'already_member') {
      setMessage({ type: 'error', text: 'Você já participa desta comunidade.' })
    } else if (result.status === 'error') {
      setMessage({ type: 'error', text: 'Não foi possível entrar agora. Tente novamente.' })
    }
  }

  return (
    <section className="community-card community-card--highlight">
      <div className="community-card-header">
        <div className="community-avatar" aria-hidden="true">
          {community.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2>{community.name}</h2>
          {badge && <span className="community-badge">{badge}</span>}
          {!badge && onJoin && (
            <span className="community-badge community-badge--outline">
              Disponível para descobrir
            </span>
          )}
        </div>
      </div>

      {community.description && <p>{community.description}</p>}

      {memberCount !== undefined && (
        <p className="community-meta">
          {memberCount === 1
            ? '1 mulher nesta comunidade'
            : `${memberCount} mulheres nesta comunidade`}
        </p>
      )}

      {onJoin && (
        <>
          {message && (
            <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
              {message.text}
            </p>
          )}
          <button type="button" onClick={handleJoin} disabled={joining}>
            {joining ? 'Entrando...' : 'Entrar'}
          </button>
        </>
      )}
    </section>
  )
}
