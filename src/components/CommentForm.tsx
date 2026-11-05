import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateCommentResult } from '../types/post'
import { EmojiPicker } from './EmojiPicker'
import { CheckIcon, PhotoIcon } from './icons'
import { FeedPhotoCropper } from './FeedPhotoCropper'

interface CommentFormProps {
  onSubmit: (content: string, imageFile?: File | null) => Promise<CreateCommentResult>
  placeholder?: string
  submitLabel?: string
  pendingLabel?: string
  /** Quando definido, mostra "Cancelar" e é chamado após enviar/cancelar. */
  onCancel?: () => void
  autoFocus?: boolean
  variant?: 'comment' | 'reply'
}

export function CommentForm({
  onSubmit,
  placeholder = 'Escreva um comentário...',
  submitLabel = 'Comentar',
  pendingLabel = 'Enviando...',
  onCancel,
  autoFocus = false,
  variant = 'comment',
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  // Foto escolhida, esperando o recorte 4:5 (estilo Instagram).
  const [cropping, setCropping] = useState<File | null>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: submitError } = await onSubmit(content.trim() || (file ? '📷' : ''), file)

    setLoading(false)

    if (submitError) {
      setError(
        variant === 'reply'
          ? 'Não foi possível responder agora. Tente novamente.'
          : 'Não foi possível comentar agora. Tente novamente.',
      )
      return
    }

    setContent('')
    setFile(null)
    onCancel?.()
  }

  return (
    <form
      className={`comment-form${variant === 'reply' ? ' comment-form--reply' : ''}`}
      onSubmit={handleSubmit}
    >
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />

      <EmojiPicker onPick={(e) => setContent((c) => c + e)} />
      <button type="button" className="comment-attach" onClick={() => fileRef.current?.click()} aria-label={file ? 'Foto anexada' : 'Anexar foto'}>
        <PhotoIcon size={20} />
        {file && <CheckIcon size={14} />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          setCropping(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      {cropping && (
        <FeedPhotoCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(cropped) => {
            setCropping(null)
            setFile(cropped)
          }}
        />
      )}

      <button type="submit" disabled={loading || (!content.trim() && !file)}>
        {loading ? pendingLabel : submitLabel}
      </button>

      {onCancel && (
        <button
          type="button"
          className="comment-form-cancel"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
      )}

      {error && <p className="auth-error">{error}</p>}
    </form>
  )
}
