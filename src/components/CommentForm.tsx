import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateCommentResult } from '../types/post'
import { EmojiPicker } from './EmojiPicker'
import { MODERATION_MESSAGE } from '../lib/moderation'

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
  // Comentários e respostas são só texto (fotos só nas publicações).

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: submitError } = await onSubmit(content.trim(), null)

    setLoading(false)

    if (submitError) {
      setError(
        submitError === MODERATION_MESSAGE
          ? MODERATION_MESSAGE
          : variant === 'reply'
          ? 'Não foi possível responder agora. Tente novamente.'
          : 'Não foi possível comentar agora. Tente novamente.',
      )
      return
    }

    setContent('')
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

      <button type="submit" disabled={loading || !content.trim()}>
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
