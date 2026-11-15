import { useEffect, useState } from 'react'
import { loadPoll, peekPoll, tallyPoll, toggleVote } from '../lib/pollStore'
import type { Poll } from '../lib/pollStore'

// Enquete dentro de uma publicação (Feed e Círculos), no estilo do WhatsApp:
// toque numa opção para votar; a barra mostra a parcial. Publicação sem
// enquete não desenha nada.

interface PostPollProps {
  postId: string
  viewerId?: string
  canVote: boolean
}

export function PostPoll({ postId, viewerId, canVote }: PostPollProps) {
  const [poll, setPoll] = useState<Poll | null>(() => peekPoll(postId) ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadPoll(postId).then((p) => {
      if (!cancelled) setPoll(p)
    })
    return () => {
      cancelled = true
    }
  }, [postId])

  if (!poll) return null

  const { counts, voters } = tallyPoll(poll)
  const mine = new Set(poll.votes.filter((v) => v.profile_id === viewerId).map((v) => v.option_index))
  const interactive = canVote && !!viewerId

  async function vote(index: number) {
    if (!interactive || busy || !poll || !viewerId) return
    setBusy(true)
    setError(null)
    const result = await toggleVote(poll, viewerId, index)
    setBusy(false)
    setPoll(result.poll)
    if (result.error) setError(result.error)
  }

  return (
    <div className="post-poll" role="group" aria-label="Enquete">
      <p className="post-poll-hint">
        {poll.allow_multiple ? 'Enquete · escolha uma ou mais' : 'Enquete · escolha uma opção'}
      </p>
      <ul className="post-poll-options">
        {poll.options.map((option, index) => {
          const count = counts[index]
          const percent = voters > 0 ? Math.round((count / voters) * 100) : 0
          const chosen = mine.has(index)
          return (
            <li key={`${index}-${option}`}>
              <button
                type="button"
                className={`post-poll-option${chosen ? ' post-poll-option--chosen' : ''}`}
                onClick={() => void vote(index)}
                disabled={!interactive || busy}
                aria-pressed={chosen}
              >
                <span className="post-poll-bar" style={{ width: `${percent}%` }} aria-hidden="true" />
                <span className="post-poll-check" aria-hidden="true">
                  {chosen ? '✓' : ''}
                </span>
                <span className="post-poll-label">{option}</span>
                <span className="post-poll-count">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="post-poll-total">
        {voters === 0 ? 'Ninguém votou ainda' : voters === 1 ? '1 pessoa votou' : `${voters} pessoas votaram`}
      </p>
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
