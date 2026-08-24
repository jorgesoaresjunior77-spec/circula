import { useState } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'

interface CircleCardProps {
  circle: CircleWithMembers
  isParticipating: boolean
  canParticipate: boolean
  onJoin: () => Promise<JoinCircleResult>
  onLeave: () => Promise<JoinCircleResult>
}

export function CircleCard({
  circle,
  isParticipating,
  canParticipate,
  onJoin,
  onLeave,
}: CircleCardProps) {
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleToggle() {
    setWorking(true)
    setActionError(null)

    const { error } = isParticipating ? await onLeave() : await onJoin()

    setWorking(false)

    if (error) {
      setActionError('Não foi possível concluir agora. Tente novamente.')
    }
  }

  return (
    <article className="circle-card">
      <h3>{circle.name}</h3>

      <p className="circle-meta">
        {circle.members.length === 1
          ? '1 mulher neste círculo'
          : `${circle.members.length} mulheres neste círculo`}
      </p>

      {circle.members.length > 0 && (
        <div className="interest-tags">
          {circle.members.map((member) => (
            <span key={member.id} className="interest-tag">
              {member.profile?.full_name ?? 'Participante'}
            </span>
          ))}
        </div>
      )}

      {canParticipate && (
        <>
          <button type="button" onClick={handleToggle} disabled={working}>
            {working ? 'Aguarde...' : isParticipating ? 'Sair' : 'Participar'}
          </button>
          {actionError && <p className="auth-error">{actionError}</p>}
        </>
      )}
    </article>
  )
}
