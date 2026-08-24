import { useState } from 'react'
import type {
  CheckinMood,
  CheckinResponse,
  RespondCheckinResult,
  ShareCheckinResult,
} from '../types/checkin'

const MOODS: { value: CheckinMood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😊', label: 'Estou muito bem' },
  { value: 'good', emoji: '🙂', label: 'Estou bem' },
  { value: 'okay', emoji: '😐', label: 'Estou mais ou menos' },
  { value: 'hard', emoji: '😔', label: 'Estou passando por uma semana difícil' },
]

interface CheckinResponseFormProps {
  myResponse: CheckinResponse | undefined
  onRespond: (mood: CheckinMood, wantsToShare: boolean) => Promise<RespondCheckinResult>
  onShare: (content: string) => Promise<ShareCheckinResult>
}

export function CheckinResponseForm({ myResponse, onRespond, onShare }: CheckinResponseFormProps) {
  const [selectedMood, setSelectedMood] = useState<CheckinMood | null>(null)
  const [showShareField, setShowShareField] = useState(false)
  const [shareText, setShareText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (myResponse) {
    const mood = MOODS.find((option) => option.value === myResponse.mood)
    return (
      <p className="checkin-answered">
        Você respondeu: {mood?.emoji} {mood?.label}
      </p>
    )
  }

  async function handleDecline() {
    if (!selectedMood) return
    setSubmitting(true)
    setError(null)

    const { error: respondError } = await onRespond(selectedMood, false)

    setSubmitting(false)

    if (respondError) {
      setError('Não foi possível registrar sua resposta agora. Tente novamente.')
    }
  }

  async function handleShare() {
    if (!selectedMood || !shareText.trim()) return
    setSubmitting(true)
    setError(null)

    const { error: respondError } = await onRespond(selectedMood, true)

    if (respondError) {
      setSubmitting(false)
      setError('Não foi possível registrar sua resposta agora. Tente novamente.')
      return
    }

    const { error: shareError } = await onShare(shareText.trim())

    setSubmitting(false)

    if (shareError) {
      setError('Sua resposta foi salva, mas não foi possível publicar agora. Tente novamente.')
      return
    }
  }

  if (!selectedMood) {
    return (
      <div className="checkin-mood-picker">
        <p className="checkin-prompt">Como você está?</p>
        <div className="checkin-mood-options">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              className="checkin-mood-button"
              onClick={() => setSelectedMood(mood.value)}
              title={mood.label}
            >
              <span aria-hidden="true">{mood.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!showShareField) {
    return (
      <div className="checkin-share-prompt">
        <p className="checkin-prompt">Quer compartilhar alguma coisa com as outras mulheres?</p>
        <div className="checkin-share-choice">
          <button type="button" onClick={() => setShowShareField(true)} disabled={submitting}>
            Sim
          </button>
          <button type="button" className="auth-link" onClick={handleDecline} disabled={submitting}>
            {submitting ? 'Aguarde...' : 'Agora não'}
          </button>
        </div>
        {error && <p className="auth-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="checkin-share-prompt">
      <label htmlFor="checkin-share-text">O que você quer compartilhar?</label>
      <textarea
        id="checkin-share-text"
        value={shareText}
        onChange={(event) => setShareText(event.target.value)}
        rows={3}
        placeholder="Escreva se quiser (opcional)..."
      />
      <button type="button" onClick={handleShare} disabled={submitting || !shareText.trim()}>
        {submitting ? 'Publicando...' : 'Compartilhar'}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
