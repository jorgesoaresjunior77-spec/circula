import { useState } from 'react'
import { useChallengeProgress } from '../hooks/useChallengeProgress'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { formatChallengePeriod, formatStartCountdown } from '../lib/challengePeriod'
import type {
  ChallengeComment,
  ChallengeCommentResult,
  ChallengeWithActivities,
  JoinChallengeResult,
} from '../types/challenge'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'
import { CommentIcon, LeafDayMark } from './icons'

const RING_RADIUS = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface ChallengeCardProps {
  challenge: ChallengeWithActivities
  currentDay: number
  participantCount: number
  todayCompletedCount: number
  isParticipating: boolean
  /** A viewer ja concluiu o desafio inteiro (linha em challenge_completions). */
  isCompleted?: boolean
  canParticipate: boolean
  profileId: string | null
  commentCount: number
  comments: ChallengeComment[] | undefined
  onJoin: () => Promise<JoinChallengeResult>
  onProgressChange?: () => void
  /** Chamado quando o estado de conclusao pode ter mudado (marcar/desmarcar dia). */
  onCompletionChange?: () => void
  onOpenComments: () => Promise<ChallengeCommentResult>
  onAddComment: (content: string) => Promise<ChallengeCommentResult>
}

export function ChallengeCard({
  challenge,
  currentDay,
  participantCount,
  todayCompletedCount,
  isParticipating,
  isCompleted = false,
  canParticipate,
  profileId,
  commentCount,
  comments,
  onJoin,
  onProgressChange,
  onCompletionChange,
  onOpenComments,
  onAddComment,
}: ChallengeCardProps) {
  const { url: coverUrl } = useSignedImageUrl(challenge.cover_image_url)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  const duration = challenge.activities.length
  const trackProgress = canParticipate && isParticipating
  const {
    completedDays,
    completed,
    allDaysDone,
    toggleDay,
    loading: progressLoading,
  } = useChallengeProgress(
    trackProgress ? challenge.id : null,
    trackProgress ? profileId : null,
    duration,
    isCompleted,
  )

  const notStarted = currentDay <= 0
  const displayDay = notStarted ? 0 : Math.min(currentDay, Math.max(duration, 1))
  const todayActivity = challenge.activities.find((activity) => activity.day_number === currentDay)
  const todayDone = completedDays.has(currentDay)
  const period = formatChallengePeriod(challenge.starts_on, challenge.ends_on)
  const isDone = completed || allDaysDone

  // Anel so quando ha dados reais de progresso (participante + dias
  // carregados). Sem dados suficientes, nenhum percentual e exibido.
  const completedInRange = Math.min(completedDays.size, duration)
  const progressPercent =
    trackProgress && duration > 0 && !progressLoading
      ? Math.round((completedInRange / duration) * 100)
      : null

  async function handleJoin() {
    setJoining(true)
    setJoinError(null)

    const { error } = await onJoin()

    setJoining(false)

    if (error) {
      setJoinError('Nao foi possivel entrar no desafio agora. Tente novamente.')
    }
  }

  async function handleToggle(dayNumber: number) {
    setToggleError(null)
    const { error } = await toggleDay(dayNumber, currentDay)
    if (error) {
      setToggleError(error)
      return
    }
    onProgressChange?.()
    onCompletionChange?.()
  }

  async function handleToggleComments() {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)

    if (nextOpen && comments === undefined) {
      setLoadingComments(true)
      await onOpenComments()
      setLoadingComments(false)
    }
  }

  return (
    <article className="challenge-card">
      {coverUrl && <img className="challenge-cover" src={coverUrl} alt="" />}

      <div className="challenge-card-head">
        <div className="challenge-card-heading">
          <h3>{challenge.title}</h3>
          {period && <p className="challenge-period">{period}</p>}
          {challenge.description && (
            <p className="challenge-description">{challenge.description}</p>
          )}
        </div>

        {progressPercent !== null && (
          <div
            className="challenge-ring"
            role="img"
            aria-label={`Progresso: ${progressPercent}% de ${duration} dias`}
          >
            <svg className="challenge-ring-svg" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="challenge-ring-track" cx="22" cy="22" r={RING_RADIUS} />
              <circle
                className="challenge-ring-fill"
                cx="22"
                cy="22"
                r={RING_RADIUS}
                style={{
                  strokeDasharray: RING_CIRCUMFERENCE,
                  strokeDashoffset: RING_CIRCUMFERENCE * (1 - progressPercent / 100),
                }}
              />
            </svg>
            <span className="challenge-ring-value">{progressPercent}%</span>
          </div>
        )}
      </div>

      <div className="challenge-progress">
        {notStarted ? (
          <p className="challenge-day-indicator">
            Começa {formatStartCountdown(challenge.starts_on)}
          </p>
        ) : (
          <>
            <p className="challenge-day-indicator">
              Dia <span className="challenge-day-current">{displayDay}</span> de {duration}
            </p>
            {todayActivity && <p className="challenge-today-activity">{todayActivity.content}</p>}
          </>
        )}
      </div>

      <p className="challenge-stats">
        {participantCount} {participantCount === 1 ? 'mulher participando' : 'mulheres participando'}
        {' · '}
        {todayCompletedCount} {todayCompletedCount === 1 ? 'fez' : 'fizeram'} o desafio de hoje
      </p>

      {canParticipate && !isParticipating && (
        <>
          <button type="button" onClick={handleJoin} disabled={joining}>
            {joining ? 'Entrando...' : 'Participar'}
          </button>
          {joinError && <p className="auth-error">{joinError}</p>}
        </>
      )}

      {trackProgress && (
        <div className="challenge-track">
          {isDone ? (
            <p className="challenge-completed-badge">Desafio concluído 🎉</p>
          ) : notStarted ? (
            <p className="challenge-notstarted">
              O primeiro dia libera {formatStartCountdown(challenge.starts_on)}.
            </p>
          ) : todayActivity ? (
            <button
              type="button"
              className="challenge-complete-day"
              onClick={() => handleToggle(currentDay)}
              disabled={progressLoading}
            >
              {todayDone ? `Dia ${displayDay} concluído ✓ — desfazer` : `Concluir o dia ${displayDay}`}
            </button>
          ) : null}

          {toggleError && <p className="auth-error">{toggleError}</p>}

          <p className="challenge-track-label">Sua trilha</p>
          <div className="challenge-day-track">
            {challenge.activities.map((activity) => {
              const unlocked = !notStarted && activity.day_number <= currentDay
              const dayCompleted = completedDays.has(activity.day_number)
              const isToday = activity.day_number === currentDay
              const markState: 'locked' | 'completed' | 'today' = !unlocked
                ? 'locked'
                : dayCompleted
                  ? 'completed'
                  : 'today'

              return (
                <button
                  key={activity.id}
                  type="button"
                  className={`challenge-day-mark${dayCompleted ? ' challenge-day-mark--completed' : ''}${
                    !unlocked ? ' challenge-day-mark--locked' : ''
                  }${isToday ? ' challenge-day-mark--today' : ''}`}
                  disabled={!unlocked || progressLoading}
                  onClick={() => handleToggle(activity.day_number)}
                  title={unlocked ? activity.content : 'Ainda não liberado'}
                >
                  <LeafDayMark state={markState} />
                  <span className="challenge-day-mark-label">
                    {activity.day_number}
                    {dayCompleted ? ' ✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="challenge-card-footer">
        <button type="button" className="post-comment-toggle" onClick={handleToggleComments}>
          <CommentIcon /> {commentCount}
        </button>
      </div>

      {commentsOpen && (
        <div className="post-comments">
          {loadingComments && <p>Carregando comentários...</p>}

          {!loadingComments && <CommentList comments={comments ?? []} />}

          {canParticipate && <CommentForm onSubmit={onAddComment} />}
        </div>
      )}
    </article>
  )
}
