import { useState } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { ChevronRightIcon } from './icons'

interface CircleCardProps {
  circle: CircleWithMembers
  isParticipating: boolean
  canParticipate: boolean
  onJoin: () => Promise<JoinCircleResult>
  onLeave: () => Promise<JoinCircleResult>
  /** Quando definido, mostra uma ação real de abrir o detalhe do círculo. */
  onOpen?: () => void
}

const AVATAR_LIMIT = 4

export function CircleCard({
  circle,
  isParticipating,
  canParticipate,
  onJoin,
  onLeave,
  onOpen,
}: CircleCardProps) {
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { url: coverUrl } = useSignedImageUrl(circle.cover_image_url)

  async function handleToggle() {
    setWorking(true)
    setActionError(null)

    const { error } = isParticipating ? await onLeave() : await onJoin()

    setWorking(false)

    if (error) {
      setActionError('Não foi possível concluir agora. Tente novamente.')
    }
  }

  const memberCount = circle.members.length
  const shownAvatars = circle.members.slice(0, AVATAR_LIMIT)
  const extraCount = memberCount - shownAvatars.length

  return (
    <article className="circle-card">
      <div className="circle-card-row">
        {coverUrl ? (
          <span className="circle-card-cover" aria-hidden="true">
            <img src={coverUrl} alt="" />
          </span>
        ) : (
          memberCount > 0 && (
            <div className="circle-avatars" aria-hidden="true">
              {shownAvatars.map((member) => (
                <span key={member.id} className="circle-avatar">
                  {member.profile?.avatar_url ? (
                    <img src={member.profile.avatar_url} alt="" />
                  ) : (
                    <span>{(member.profile?.full_name ?? 'P').charAt(0).toUpperCase()}</span>
                  )}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="circle-avatar circle-avatar--more">+{extraCount}</span>
              )}
            </div>
          )
        )}

        <div className="circle-card-titles">
          <h3>{circle.name}</h3>
          <p className="circle-meta">
            {memberCount === 1
              ? '1 mulher neste círculo'
              : `${memberCount} mulheres neste círculo`}
          </p>
        </div>

        {onOpen && (
          <button
            type="button"
            className="circle-card-open"
            onClick={onOpen}
            aria-label={`Abrir círculo ${circle.name}`}
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>

      {canParticipate && (
        <button type="button" onClick={handleToggle} disabled={working}>
          {working ? 'Aguarde...' : isParticipating ? 'Sair' : 'Participar'}
        </button>
      )}
      {canParticipate && actionError && <p className="auth-error">{actionError}</p>}
    </article>
  )
}
