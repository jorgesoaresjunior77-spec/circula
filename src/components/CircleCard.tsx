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
  /**
   * 'row' (padrão) — linha compacta com pilha de avatares (uso atual:
   * Painel · Círculos, ao lado de Editar/Excluir). Comportamento e
   * marcação IDÊNTICOS aos de antes desta etapa — nada mudou aqui, e o
   * default preserva CircleManager.tsx sem precisar tocar nele.
   * 'grid' — composição editorial 4:5 do destino "Círculos" (imagem
   * protagonista, informação abaixo), usada explicitamente pelo
   * CircleList. Mesmos dados e mesmos handlers de join/leave/abrir; só
   * a apresentação muda.
   */
  variant?: 'row' | 'grid'
  /** Só usado no variant 'grid', para alternar o tom de fundo dos
   *  círculos sem capa (mesmo princípio do HomeCirclesSection: nunca
   *  imagem inventada, só uma superfície tonal). */
  index?: number
}

const AVATAR_LIMIT = 4

export function CircleCard({
  circle,
  isParticipating,
  canParticipate,
  onJoin,
  onLeave,
  onOpen,
  variant = 'row',
  index = 0,
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

  if (variant === 'row') {
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

  const memberLabel = memberCount === 1 ? '1 mulher' : `${memberCount} mulheres`

  return (
    <article className="circle-card circle-card--grid" data-tint={index % 3}>
      <button
        type="button"
        className="circle-card-link"
        onClick={onOpen}
        aria-label={`Abrir círculo ${circle.name}`}
      >
        <span className="circle-card-photo">
          {coverUrl && <img src={coverUrl} alt="" />}
        </span>

        <span className="circle-card-info">
          <span className="circle-card-name" role="heading" aria-level={3}>
            {circle.name}
          </span>
          <span className="circle-card-rule" aria-hidden="true" />
          <span className="circle-card-meta-row">
            {memberCount > 0 && (
              <span className="circle-card-avatars" aria-hidden="true">
                {shownAvatars.map((member) => (
                  <span key={member.id} className="circle-card-avatar">
                    {member.profile?.avatar_url ? (
                      <img src={member.profile.avatar_url} alt="" />
                    ) : (
                      <span>{(member.profile?.full_name ?? 'P').charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="circle-card-avatar circle-card-avatar--more">
                    +{extraCount}
                  </span>
                )}
              </span>
            )}
            <span className="circle-card-count">{memberLabel}</span>
          </span>
        </span>
      </button>

      {canParticipate && (
        <button
          type="button"
          className="circle-card-toggle"
          onClick={handleToggle}
          disabled={working}
        >
          {working ? 'Aguarde...' : isParticipating ? 'Sair' : 'Participar'}
        </button>
      )}
      {canParticipate && actionError && <p className="auth-error">{actionError}</p>}
    </article>
  )
}
