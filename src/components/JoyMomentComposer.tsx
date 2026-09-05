import { useState } from 'react'
import type { FormEvent } from 'react'
import type { JoyMomentInput, JoyResult } from '../types/joy'
import { JOY_PROMPTS } from '../types/joy'
import { CoverImageInput } from './CoverImageInput'
import { SparkleIcon } from './icons'

// Fase 4 — compositor do Momento de Alegria.
// Leve e direto: um convite gentil, um campo grande de texto, foto
// opcional e um único botão claro. Nada de "diário" — é celebração.

interface JoyMomentComposerProps {
  communityId: string
  profileId: string
  onSubmit: (input: JoyMomentInput) => Promise<JoyResult>
}

export function JoyMomentComposer({ communityId, profileId, onSubmit }: JoyMomentComposerProps) {
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      setError('Escreva uma linha sobre a sua alegria de hoje 🌟')
      return
    }
    setBusy(true)
    setError(null)
    const { error: opError } = await onSubmit({ body, image_url: imageUrl })
    setBusy(false)
    if (opError) {
      setError('Não foi possível compartilhar agora. Tente novamente.')
      return
    }
    setBody('')
    setImageUrl('')
  }

  return (
    <form className="joy-composer" onSubmit={handleSubmit}>
      <p className="joy-composer-invite">
        <SparkleIcon size={18} />
        <span>Compartilhe uma coisa boa que aconteceu hoje. Pequenas alegrias também contam.</span>
      </p>

      <label className="joy-composer-label" htmlFor="joy-body">
        Sua alegria de hoje
      </label>
      <textarea
        id="joy-body"
        className="joy-composer-text"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={JOY_PROMPTS[0]}
      />

      <CoverImageInput
        id="joy-image"
        communityId={communityId}
        uid={profileId}
        label="Foto (opcional)"
        value={imageUrl}
        onChange={setImageUrl}
      />

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="joy-composer-submit" disabled={busy}>
        {busy ? 'Compartilhando…' : 'Compartilhar minha alegria'}
      </button>
    </form>
  )
}
