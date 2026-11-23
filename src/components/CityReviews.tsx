import { useEffect, useState } from 'react'
import type { CityReview } from '../lib/city'
import { findBlockedTerm, MODERATION_MESSAGE } from '../lib/moderation'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { adminDeleteReview, deleteReview, fetchReviews, saveReview } from '../hooks/useCity'

// Estrelas e comentários de um lugar ou profissional, como no Google: cada
// participante avalia uma vez (de 1 a 5 estrelas), pode comentar e mudar depois.

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const full = Math.round(value)
  return (
    <span className="cty-stars" role="img" aria-label={`${value.toFixed(1).replace('.', ',')} de 5 estrelas`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? 'cty-star cty-star--on' : 'cty-star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

export function averageOf(list: { nota: number }[]): number | null {
  return list.length ? Math.round((list.reduce((s, r) => s + r.nota, 0) / list.length) * 10) / 10 : null
}

interface CityReviewsProps {
  listingId: string
  isAuthor: boolean
  isAdmin: boolean
  readOnly?: boolean
  /** Chamado depois de avaliar/apagar, com a nova média e o total. */
  onSummary: (media: number | null, total: number, minhaNota: number | null) => void
}

export function CityReviews({ listingId, isAuthor, isAdmin, readOnly = false, onSummary }: CityReviewsProps) {
  const [reviews, setReviews] = useState<CityReview[] | null>(null)
  const [nota, setNota] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchReviews(listingId).then((list) => {
      if (cancelled) return
      setReviews(list)
      const mine = list.find((r) => r.minha)
      if (mine) {
        setNota(mine.nota)
        setComment(mine.comentario ?? '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [listingId])

  async function refresh() {
    const list = await fetchReviews(listingId)
    setReviews(list)
    const mine = list.find((r) => r.minha)
    onSummary(averageOf(list), list.length, mine?.nota ?? null)
    if (!mine) {
      setNota(0)
      setComment('')
    }
  }

  async function submit() {
    setError(null)
    if (nota < 1) return setError('Toque nas estrelas para dar a sua nota.')
    if (findBlockedTerm(comment)) return setError(MODERATION_MESSAGE)
    setBusy(true)
    const r = await saveReview(listingId, nota, comment)
    setBusy(false)
    if (r.error) return setError(r.error)
    await refresh()
  }

  async function removeMine() {
    setBusy(true)
    await deleteReview(listingId)
    setBusy(false)
    await refresh()
  }

  const mine = reviews?.find((r) => r.minha) ?? null

  return (
    <div className="cty-reviews">
      {!reviews && <p className="home-muted">Carregando avaliações…</p>}

      {!isAuthor && !readOnly && (
        <div className="cty-review-form">
          <p className="cty-label">{mine ? 'Sua avaliação' : 'Avalie este lugar'}</p>
          <div className="cty-star-picker" role="radiogroup" aria-label="Sua nota">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={nota === n}
                aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                className={`cty-star-btn${n <= nota ? ' cty-star-btn--on' : ''}`}
                onClick={() => setNota(n)}
              >
                ★
              </button>
            ))}
          </div>
          <label className="cty-field">
            <span className="cty-label">Comentário (opcional)</span>
            <textarea rows={3} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi a sua experiência" />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="cty-actions">
            <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy} onClick={() => void submit()}>
              {mine ? 'Atualizar avaliação' : 'Publicar avaliação'}
            </button>
            {mine && (
              <button type="button" className="cty-btn cty-btn--small" disabled={busy} onClick={() => void removeMine()}>
                Apagar a minha
              </button>
            )}
          </div>
        </div>
      )}
      {isAuthor && <p className="cty-note">Você criou este cadastro, então não pode avaliá-lo. As avaliações das outras mulheres aparecem aqui.</p>}

      {reviews && reviews.length === 0 && <p className="home-muted">Ainda não há avaliações.</p>}
      {reviews?.map((r) => (
        <div key={r.user_id} className="cty-review">
          <div className="cty-review-head">
            {r.avatar ? (
              <img className="cty-avatar" src={r.avatar} alt="" loading="lazy" />
            ) : (
              <span className="cty-avatar cty-avatar--ph" aria-hidden="true">
                {r.nome.charAt(0).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{r.nome}</strong> · {formatRelativeTime(r.criado_em)}
            </span>
            <Stars value={r.nota} size={16} />
          </div>
          {r.comentario && <p className="cty-card-desc">{r.comentario}</p>}
          {isAdmin && !r.minha && (
            <button
              type="button"
              className="cty-link cty-link--danger"
              onClick={() => {
                if (window.confirm('Apagar este comentário?')) void adminDeleteReview(listingId, r.user_id).then(refresh)
              }}
            >
              Apagar comentário (administração)
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
