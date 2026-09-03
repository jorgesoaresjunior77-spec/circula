import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { CreatePostResult } from '../types/post'

interface PostComposerProps {
  onPublish: (content: string, imageUrl: string | null) => Promise<CreatePostResult>
  onUploadImage: (file: File) => Promise<{ url: string | null; error: string | null }>
  /** Ex.: "Publicando no círculo Corrida de Rua" — só aparece se definido. */
  contextLabel?: string
}

export function PostComposer({ onPublish, onUploadImage, contextLabel }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setImageFile(file)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    let imageUrl: string | null = null

    if (imageFile) {
      const upload = await onUploadImage(imageFile)
      if (upload.error || !upload.url) {
        setLoading(false)
        setError('Não foi possível enviar a imagem agora. Tente novamente.')
        return
      }
      imageUrl = upload.url
    }

    const { error: publishError } = await onPublish(content, imageUrl)

    setLoading(false)

    if (publishError) {
      setError('Não foi possível publicar agora. Tente novamente.')
      return
    }

    setContent('')
    removeImage()
  }

  return (
    <section className="community-card post-composer">
      <form onSubmit={handleSubmit}>
        {contextLabel && <p className="post-composer-context">{contextLabel}</p>}
        <label htmlFor="post-content">O que você quer compartilhar?</label>
        <textarea
          id="post-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          required
        />

        {imagePreview ? (
          <div className="post-composer-image">
            <img src={imagePreview} alt="Pré-visualização da imagem do post" />
            <button
              type="button"
              className="auth-link"
              onClick={removeImage}
              disabled={loading}
            >
              Remover imagem
            </button>
          </div>
        ) : (
          <div className="post-composer-actions">
            <button
              type="button"
              className="auth-link"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Adicionar imagem
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          hidden
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading || !content.trim()}>
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </form>
    </section>
  )
}
