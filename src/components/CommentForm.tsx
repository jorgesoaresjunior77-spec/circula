import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateCommentResult } from '../types/post'

interface CommentFormProps {
  onSubmit: (content: string) => Promise<CreateCommentResult>
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: submitError } = await onSubmit(content)

    setLoading(false)

    if (submitError) {
      setError('Não foi possível comentar agora. Tente novamente.')
      return
    }

    setContent('')
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Escreva um comentário..."
        aria-label="Escreva um comentário..."
        required
      />

      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? 'Enviando...' : 'Comentar'}
      </button>

      {error && <p className="auth-error">{error}</p>}
    </form>
  )
}
