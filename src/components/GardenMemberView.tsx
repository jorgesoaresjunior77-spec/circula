import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGardenMember } from '../hooks/useGardenMember'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { GardenColorPicker } from './GardenColorPicker'
import { EmptyState } from './EmptyState'
import { SproutIcon, CheckIcon } from './icons'
import type { GardenChallenge } from '../types/garden'
import type { GardenColor, Profile, ProfileUpdateInput } from '../types/profile'

interface GardenMemberViewProps {
  communityId: string
  profileId: string
  profile: Profile | null
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<{ error: string | null }>
  /** Chamado após publicar um compartilhamento — para o Feed recarregar. */
  onShared?: () => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function ChallengeCard({
  challenge,
  enrolled,
  onSelect,
}: {
  challenge: GardenChallenge
  enrolled: boolean
  onSelect: () => void
}) {
  const { url: coverUrl } = useSignedImageUrl(challenge.cover_image_url)

  return (
    <button type="button" className="garden-challenge-card" onClick={onSelect}>
      <div className="garden-challenge-card-cover" aria-hidden="true">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <SproutIcon size={28} />}
      </div>
      <div className="garden-challenge-card-body">
        <p className="garden-challenge-card-title">{challenge.title}</p>
        {challenge.description && <p className="garden-challenge-card-desc">{challenge.description}</p>}
        <p className="garden-challenge-card-meta">
          {challenge.duration_days} dias · início {challenge.starts_on}
        </p>
        {enrolled && <span className="garden-status-badge garden-status-badge--enrolled">Participando</span>}
      </div>
    </button>
  )
}

function ShareComposer({
  onShare,
}: {
  onShare: (content: string) => Promise<{ error: string | null }>
}) {
  const [content, setContent] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await onShare(content)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    setContent('')
  }

  if (!open) {
    return (
      <button type="button" className="garden-day-share-toggle" onClick={() => setOpen(true)}>
        Compartilhar no feed
      </button>
    )
  }

  return (
    <form className="garden-share-composer" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Conte como foi (opcional)"
      />
      {error && <p className="auth-error">{error}</p>}
      <div className="panel-content-row-actions">
        <button type="button" className="panel-content-action" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="submit" className="panel-content-action panel-content-action--primary" disabled={busy}>
          {busy ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}

export function GardenMemberView({
  communityId,
  profileId,
  profile,
  onUpdateProfile,
  onShared,
}: GardenMemberViewProps) {
  const api = useGardenMember(communityId, profileId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [completingDayId, setCompletingDayId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selected = api.challenges.find((c) => c.id === selectedId) ?? null
  const myEnrollment = selected ? api.myEnrollments.find((e) => e.challenge_id === selected.id) : null
  const days = selected ? (api.daysByChallenge[selected.id] ?? []) : []
  const myCompletionsByDay = new Map(
    api.myCompletions.filter((c) => c.challenge_id === selected?.id).map((c) => [c.challenge_day_id, c]),
  )

  function selectChallenge(challenge: GardenChallenge) {
    setSelectedId(challenge.id)
    setActionError(null)
    api.fetchDays(challenge.id)
  }

  async function handleEnroll(challengeId: string) {
    setEnrolling(true)
    setActionError(null)
    const { error } = await api.enroll(challengeId)
    setEnrolling(false)
    if (error) setActionError(error)
  }

  async function handleComplete(dayId: string) {
    setCompletingDayId(dayId)
    setActionError(null)
    const { error } = await api.completeDay(dayId)
    setCompletingDayId(null)
    if (error) setActionError(error)
  }

  function handleSaveColors(colorOne: GardenColor | null, colorTwo: GardenColor | null) {
    return onUpdateProfile({ garden_color_one: colorOne, garden_color_two: colorTwo })
  }

  async function handleShare(completionId: string, content: string) {
    const result = await api.shareCompletion(completionId, content)
    if (!result.error) onShared?.()
    return result
  }

  if (api.loading) return <p className="panel-content-muted">Carregando Meu Jardim...</p>
  if (api.error) return <p className="auth-error">{api.error}</p>

  return (
    <div className="garden-member-view">
      {profile && (
        <GardenColorPicker
          colorOne={profile.garden_color_one}
          colorTwo={profile.garden_color_two}
          onSave={handleSaveColors}
        />
      )}

      {selected ? (
        <section className="garden-detail">
          <button type="button" className="panel-content-action" onClick={() => setSelectedId(null)}>
            ← Todos os desafios
          </button>

          <h3 className="garden-detail-title">{selected.title}</h3>
          {selected.description && <p className="garden-detail-desc">{selected.description}</p>}

          {actionError && <p className="auth-error">{actionError}</p>}

          {!myEnrollment ? (
            <button
              type="button"
              className="panel-content-submit"
              onClick={() => handleEnroll(selected.id)}
              disabled={enrolling}
            >
              {enrolling ? 'Entrando...' : 'Participar deste desafio'}
            </button>
          ) : days.length === 0 ? (
            <p className="panel-content-muted">Nenhuma atividade cadastrada ainda.</p>
          ) : (
            <ul className="garden-day-timeline">
              {days.map((day) => {
                const released = day.activity_date <= todayIso()
                const isToday = day.activity_date === todayIso()
                const completion = myCompletionsByDay.get(day.id)
                return (
                  <li
                    key={day.id}
                    className={`garden-day${released ? '' : ' garden-day--future'}${
                      isToday ? ' garden-day--today' : ''
                    }${completion ? ' garden-day--done' : ''}`}
                  >
                    <div className="garden-day-head">
                      <span className="garden-day-number">Dia {day.day_number}</span>
                      {isToday && <span className="garden-status-badge">Hoje</span>}
                      {!released && <span className="garden-status-badge garden-status-badge--draft">Em breve</span>}
                    </div>
                    <p className="garden-day-title">
                      {day.icon ? `${day.icon} ` : ''}
                      {day.title}
                    </p>
                    {day.instructions && <p className="garden-day-instructions">{day.instructions}</p>}

                    {released &&
                      (completion ? (
                        <div className="garden-day-done-row">
                          <span className="garden-day-done-mark">
                            <CheckIcon size={14} /> Concluído
                          </span>
                          <ShareComposer onShare={(content) => handleShare(completion.id, content)} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="garden-day-complete"
                          onClick={() => handleComplete(day.id)}
                          disabled={completingDayId === day.id}
                        >
                          {completingDayId === day.id ? 'Marcando...' : 'Marcar como concluído'}
                        </button>
                      ))}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : api.challenges.length === 0 ? (
        <EmptyState message="Nenhum desafio disponível nesta comunidade ainda." />
      ) : (
        <div className="garden-challenge-grid">
          {api.challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              enrolled={api.myEnrollments.some((e) => e.challenge_id === challenge.id)}
              onSelect={() => selectChallenge(challenge)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
