import { useState } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'
import { Feed } from './Feed'
import { ChevronLeftIcon } from './icons'

const AVATAR_LIMIT = 6

interface CircleDetailProps {
  circle: CircleWithMembers
  profileId: string
  communityId: string
  communityName?: string
  isParticipating: boolean
  onBack: () => void
  onJoin: () => Promise<JoinCircleResult>
  onLeave: () => Promise<JoinCircleResult>
}

export function CircleDetail({
  circle,
  profileId,
  communityId,
  communityName,
  isParticipating,
  onBack,
  onJoin,
  onLeave,
}: CircleDetailProps) {
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

  const memberCount = circle.members.length
  const shownAvatars = circle.members.slice(0, AVATAR_LIMIT)
  const extraCount = memberCount - shownAvatars.length

  return (
    <section className="circle-detail">
      <button type="button" className="circle-detail-back" onClick={onBack}>
        <ChevronLeftIcon size={16} />
        Voltar para círculos
      </button>

      <div className="community-card community-card--highlight community-hero circle-detail-hero">
        <div className="community-hero-cover" aria-hidden="true">
          {circle.cover_image_url && (
            <img
              className="community-hero-cover-image"
              src={circle.cover_image_url}
              alt=""
            />
          )}
        </div>

        <div className="community-hero-body">
          <div className="community-hero-titles">
            {communityName && (
              <p className="circle-detail-context">Círculo de {communityName}</p>
            )}
            <h2 className="community-hero-name">{circle.name}</h2>
          </div>

          <p className="circle-detail-meta">
            {memberCount === 1 ? '1 mulher neste círculo' : `${memberCount} mulheres neste círculo`}
          </p>

          {memberCount > 0 && (
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
          )}

          <div className="circle-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleToggle}
              disabled={working}
            >
              {working ? 'Aguarde...' : isParticipating ? 'Sair do círculo' : 'Entrar no círculo'}
            </button>
            {actionError && <p className="auth-error">{actionError}</p>}
          </div>
        </div>
      </div>

      {!isParticipating && (
        <p className="circle-detail-hint">
          Entre no círculo para publicar. Você já pode ver as publicações.
        </p>
      )}

      <Feed
        communityId={communityId}
        authorId={profileId}
        canPost={isParticipating}
        circleId={circle.id}
        circleName={circle.name}
      />
    </section>
  )
}
