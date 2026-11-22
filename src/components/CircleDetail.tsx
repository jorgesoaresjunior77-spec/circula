import { useEffect, useRef, useState } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { Feed } from './Feed'
import { MemberInvitePanel } from './InviteFriends'
import { ChevronLeftIcon } from './icons'

const AVATAR_LIMIT = 6

interface CircleDetailProps {
  circle: CircleWithMembers
  profileId: string
  communityId: string
  communityName?: string
  isParticipating: boolean
  /** A profissional dona da comunidade lê e publica em todos os círculos. */
  isOwner?: boolean
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
  isOwner = false,
  onBack,
  onJoin,
  onLeave,
}: CircleDetailProps) {
  const [working, setWorking] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Boas-vindas: aparece para quem participa até ela fechar ou escrever a
  // primeira mensagem (guardado neste aparelho, por círculo).
  const welcomeKey = `circula:circle-welcome:${circle.id}:${profileId}`
  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try {
      return localStorage.getItem(welcomeKey) === '1'
    } catch {
      return false
    }
  })
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setWelcomeSeen(localStorage.getItem(welcomeKey) === '1')
    } catch {
      setWelcomeSeen(false)
    }
  }, [welcomeKey])

  function dismissWelcome() {
    try {
      localStorage.setItem(welcomeKey, '1')
    } catch {
      /* sem storage: some só nesta visita */
    }
    setWelcomeSeen(true)
  }

  function writeFirstMessage() {
    dismissWelcome()
    const root = feedRef.current
    if (!root) return
    root.querySelector<HTMLButtonElement>('.post-composer-invite-prompt')?.click()
    window.setTimeout(() => {
      const field = root.querySelector<HTMLTextAreaElement>('textarea')
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field?.focus()
    }, 120)
  }

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
  const { url: coverUrl } = useSignedImageUrl(circle.cover_image_url)

  return (
    <section className="circle-detail">
      <button type="button" className="circle-detail-back" onClick={onBack}>
        <ChevronLeftIcon size={16} />
        Voltar para círculos
      </button>

      <div className="community-card community-card--highlight community-hero circle-detail-hero">
        <div className="community-hero-cover" aria-hidden="true">
          {coverUrl && (
            <img loading="lazy" decoding="async"
              className="community-hero-cover-image"
              src={coverUrl}
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

          {circle.description && <p className="circle-detail-description">{circle.description}</p>}

          <p className="circle-detail-meta">
            {memberCount === 1 ? '1 mulher neste círculo' : `${memberCount} mulheres neste círculo`}
          </p>

          {memberCount > 0 && (
            <div className="circle-avatars" aria-hidden="true">
              {shownAvatars.map((member) => (
                <span key={member.id} className="circle-avatar">
                  {member.profile?.avatar_url ? (
                    <img loading="lazy" decoding="async" src={member.profile.avatar_url} alt="" />
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
              className={`btn btn-primary circle-detail-toggle${isParticipating ? ' circle-detail-toggle--leave' : ''}`}
              onClick={handleToggle}
              disabled={working}
            >
              {working ? 'Aguarde...' : isParticipating ? 'Sair do círculo' : 'Entrar no círculo'}
            </button>
            <button
              type="button"
              className="btn circle-detail-invite"
              onClick={() => setInviteOpen((v) => !v)}
              aria-expanded={inviteOpen}
            >
              {inviteOpen ? 'Fechar convite' : 'Convidar'}
            </button>
            {actionError && <p className="auth-error">{actionError}</p>}
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="community-card circle-invite-card">
          <h3 className="circle-invite-title">Convide alguém para o círculo {circle.name}</h3>
          <MemberInvitePanel communityId={communityId} circleName={circle.name} />
        </div>
      )}

      {!isParticipating && !isOwner && (
        <div className="circle-detail-locked">
          <p className="circle-detail-locked-title">As conversas são só para quem está no círculo</p>
          <p className="circle-detail-hint">
            Entre no círculo para ler as mensagens, responder, votar nas enquetes e participar.
          </p>
        </div>
      )}

      {isParticipating && !welcomeSeen && (
        <div className="circle-welcome" role="status">
          <p className="circle-welcome-title">Bem-vinda ao círculo {circle.name}! 🌸</p>
          <p className="circle-welcome-text">
            Que bom ter você aqui. Este é um espaço de troca e acolhimento. Que tal se apresentar e deixar a sua
            primeira mensagem?
          </p>
          <div className="circle-welcome-actions">
            <button type="button" className="btn btn-primary" onClick={writeFirstMessage}>
              Escrever minha primeira mensagem
            </button>
            <button type="button" className="auth-link" onClick={dismissWelcome}>
              Agora não
            </button>
          </div>
        </div>
      )}

      {(isParticipating || isOwner) && (
        <div ref={feedRef}>
          <Feed
            communityId={communityId}
            authorId={profileId}
            canPost={isParticipating || isOwner}
            circleId={circle.id}
            circleName={circle.name}
          />
        </div>
      )}
    </section>
  )
}
