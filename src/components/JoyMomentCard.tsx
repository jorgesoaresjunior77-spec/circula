import { useState } from 'react'
import type { JoyMoment, JoyMomentInput, JoyResult } from '../types/joy'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { CoverImageInput } from './CoverImageInput'
import { SparkleIcon } from './icons'

// Fase 4 — card de um Momento de Alegria.
// Visual alegre e claro: acento de brilho, foto grande quando houver,
// texto grande. Só o próprio autor vê "Editar"/"Excluir" (edição inline).

interface JoyMomentCardProps {
  moment: JoyMoment
  isOwn: boolean
  profileId: string
  onUpdate: (momentId: string, input: JoyMomentInput) => Promise<JoyResult>
  onDelete: (momentId: string) => Promise<JoyResult>
}

export function JoyMomentCard({ moment, isOwn, profileId, onUpdate, onDelete }: JoyMomentCardProps) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(moment.body)
  const [imageUrl, setImageUrl] = useState(moment.image_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorName = moment.author?.full_name ?? 'Uma mulher do Círcula'

  function startEdit() {
    setBody(moment.body)
    setImageUrl(moment.image_url ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!body.trim()) {
      setError('Escreva algo antes de salvar.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: opError } = await onUpdate(moment.id, { body, image_url: imageUrl })
    setBusy(false)
    if (opError) {
      setError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    setEditing(false)
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const { error: opError } = await onDelete(moment.id)
    if (opError) {
      setBusy(false)
      setError('Não foi possível remover agora. Tente novamente.')
    }
  }

  return (
    <article className="joy-card">
      <header className="joy-card-head">
        <span className="joy-card-avatar" aria-hidden="true">
          {moment.author?.avatar_url ? (
            <img src={moment.author.avatar_url} alt="" />
          ) : (
            <span>{authorName.charAt(0).toUpperCase()}</span>
          )}
        </span>
        <span className="joy-card-meta">
          <span className="joy-card-author">{authorName}</span>
          <span className="joy-card-time">{formatRelativeTime(moment.created_at)}</span>
        </span>
        <SparkleIcon size={18} className="joy-card-mark" />
      </header>

      {editing ? (
        <>
          <textarea
            className="joy-composer-text"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <CoverImageInput
            id={`joy-edit-${moment.id}`}
            uid={profileId}
            label="Foto (opcional)"
            value={imageUrl}
            onChange={setImageUrl}
          />
          {error && <p className="auth-error">{error}</p>}
          <div className="joy-card-actions challenge-item-actions">
            <button type="button" className="auth-link" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="challenge-save-button"
              onClick={save}
              disabled={busy}
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="joy-card-body">{moment.body}</p>
          {moment.image_url && (
            <div className="joy-card-image">
              <img src={moment.image_url} alt="" />
            </div>
          )}
          {error && <p className="auth-error">{error}</p>}
          {isOwn && (
            <div className="joy-card-actions challenge-item-actions">
              <button type="button" onClick={startEdit} disabled={busy}>
                Editar
              </button>
              <button
                type="button"
                className="challenge-delete-button"
                onClick={remove}
                disabled={busy}
              >
                Excluir
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}
