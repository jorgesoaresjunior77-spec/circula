import { useState } from 'react'
import { useChallengeProgress } from '../hooks/useChallengeProgress'
import type {
  ChallengeComment,
  ChallengeCommentResult,
  ChallengeWithActivities,
  JoinChallengeResult,
} from '../types/challenge'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'
import { CommentIcon, LeafDayMark } from './icons'

interface ChallengeCardProps {
  challenge: ChallengeWithActivities
  currentDay: number
  participantCount: number
  todayCompletedCount: number
  isParticipating: boolean
  canParticipate: boolean
  profileId: string | null
  commentCount: number
  comments: ChallengeComment[] | undefined
  onJoin: () => Promise<JoinChallengeResult>
  onProgressChange?: () => void
  onOpenComments: () => Promise<ChallengeCommentResult>
  onAddComment: (content: string) => Promise<ChallengeCommentResult>
}

export function ChallengeCard({
  challenge,
  currentDay,
  participantCount,
  todayCompletedCount,
  isParticipating,
  canParticipate,
  profileId,
  commentCount,
  comments,
  onJoin,
  onProgressChange,
  onOpenComments,
  onAddComment,
}: ChallengeCardProps) {
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  const trackProgress = canParticipate && isParticipating
  const { completedDays, toggleDay, loading: progressLoading } = useChallengeProgress(
    trackProgress ? challenge.id : null,
    trackProgress ? profileId : null,
  )

  const duration = challenge.activities.length
  const displayDay = Math.min(currentDay, Math.max(duration, 1))
  const todayActivity = challenge.activities.find((activity) => activity.day_number === currentDay)

  async function handleJoin() {
    setJoining(true)
    setJoinError(null)

    const { error } = await onJoin()

    setJoining(false)

    if (error) {
      setJoinError('Não foi possível entrar no desafio agora. Tente novamente.')
    }
  }

  async function handleToggle(dayNumber: number) {
    const { error } = await toggleDay(dayNumber, currentDay)
    if (!error) onProgressChange?.()
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
      <h3>{challenge.title}</h3>

      {challenge.description && <p className="challenge-description">{challenge.description}</p>}

      <p className="challenge-day-indicator">
        Dia {displayDay} de {duration}
      </p>

      {todayActivity && <p className="challenge-today-activity">{todayActivity.content}</p>}

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

      {canParticipate && isParticipating && (
        <div className="challenge-day-track">
          {challenge.activities.map((activity) => {
            const unlocked = activity.day_number <= currentDay
            const completed = completedDays.has(activity.day_number)
            const isToday = activity.day_number === currentDay
            const markState: 'locked' | 'completed' | 'today' = !unlocked
              ? 'locked'
              : completed
                ? 'completed'
                : 'today'

            return (
              <button
                key={activity.id}
                type="button"
                className={`challenge-day-mark${completed ? ' challenge-day-mark--completed' : ''}${
                  !unlocked ? ' challenge-day-mark--locked' : ''
                }${isToday ? ' challenge-day-mark--today' : ''}`}
                disabled={!unlocked || progressLoading}
                onClick={() => handleToggle(activity.day_number)}
                title={unlocked ? activity.content : 'Ainda não liberado'}
              >
                <LeafDayMark state={markState} />
                <span className="challenge-day-mark-label">
                  {activity.day_number}
                  {completed ? ' ✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div>
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
