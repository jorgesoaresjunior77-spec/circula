import { useState } from 'react'
import { useSessionPages } from '../hooks/useSessionPages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'
import { MultiPageUpload } from './MultiPageUpload'

// Profissional: páginas (imagens) de uma prática de respiração/meditação, na
// ordem de leitura — igual às páginas de e-book, receita e revista.

interface Props {
  sessionId: string
  communityId: string
  profileId: string
  onChanged?: () => void
}

function Thumb({ path }: { path: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img src={url} alt="" className="rec-pages-thumb" /> : <span className="rec-pages-thumb" />
}

export function SessionPagesEditor({ sessionId, communityId, profileId, onChanged }: Props) {
  const { pages, addPage, addPages, removePage } = useSessionPages(sessionId, communityId)
  const [error, setError] = useState<string | null>(null)
  const [fieldKey, setFieldKey] = useState(0)

  async function handleNew(path: string) {
    if (!path) return
    setError(null)
    const r = await addPage(path)
    if (r.error) setError(r.error)
    else {
      setFieldKey((k) => k + 1)
      onChanged?.()
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    const r = await removePage(id)
    if (r.error) setError(r.error)
    else onChanged?.()
  }

  return (
    <fieldset className="rec-pages-editor">
      <legend>Páginas da prática ({pages.length})</legend>
      <p className="home-muted">
        Suba as imagens na ordem de leitura (uma para cada passo ou tipo de respiração). Não há limite de
        páginas.
      </p>
      <ol className="rec-pages-list">
        {pages.map((p, i) => (
          <li key={p.id}>
            <Thumb path={p.image_path} />
            <span>Página {i + 1}</span>
            <button type="button" className="auth-link" onClick={() => void handleRemove(p.id)}>
              Remover
            </button>
          </li>
        ))}
      </ol>
      <MultiPageUpload
        communityId={communityId}
        uid={profileId}
        onUploaded={async (paths) => {
          const r = await addPages(paths)
          if (!r.error) onChanged?.()
          return r.error
        }}
      />
      <CoverImageInput
        key={fieldKey}
        value=""
        communityId={communityId}
        uid={profileId}
        label="Ou adicionar uma página só"
        aspectRatio="3 / 4"
        recommendedSize="1080 × 1440 px"
        onChange={(path) => void handleNew(path)}
      />
      {error && <p className="auth-error">{error}</p>}
    </fieldset>
  )
}
