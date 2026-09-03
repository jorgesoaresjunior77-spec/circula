import { useState } from 'react'
import type { FormEvent } from 'react'

interface CreateCommunityFormProps {
  onCreate: (input: {
    name: string
    slug: string
    description: string
    cover_image_url?: string | null
  }) => Promise<{ error: string | null }>
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function CreateCommunityForm({ onCreate }: CreateCommunityFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: createError } = await onCreate({
      name,
      slug: slugify(name),
      description,
      cover_image_url: coverImageUrl,
    })

    setLoading(false)

    if (createError) {
      setError(
        createError.includes('duplicate key')
          ? 'Já existe uma comunidade com esse nome, ou você já possui uma comunidade.'
          : 'Não foi possível criar a comunidade agora. Tente novamente.',
      )
    }
  }

  return (
    <section className="community-card">
      <h2>Crie sua comunidade</h2>
      <p className="auth-subtitle">
        Este é o espaço onde as mulheres vão se conectar, conversar e se apoiar.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="community-name">Nome da comunidade</label>
        <input
          id="community-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="community-description">Sobre a comunidade</label>
        <textarea
          id="community-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />

        <label htmlFor="community-cover">URL da imagem de capa (opcional)</label>
        <input
          id="community-cover"
          type="url"
          value={coverImageUrl}
          onChange={(event) => setCoverImageUrl(event.target.value)}
          placeholder="https://..."
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Criando...' : 'Criar comunidade'}
        </button>
      </form>
    </section>
  )
}
