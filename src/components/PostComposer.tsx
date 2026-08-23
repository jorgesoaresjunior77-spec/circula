import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CreatePostResult } from '../types/post'

interface PostComposerProps {
  onPublish: (content: string) => Promise<CreatePostResult>
}

export function PostComposer({ onPublish }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: publishError } = await onPublish(content)

    setLoading(false)

    if (publishError) {
      setError('Não foi possível publicar agora. Tente novamente.')
      return
    }

    setContent('')
  }

  return (
    <section className="community-card post-composer">
      <form onSubmit={handleSubmit}>
        <label htmlFor="post-content">O que você quer compartilhar?</label>
        <textarea
          id="post-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading || !content.trim()}>
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </form>
    </section>
  )
}
