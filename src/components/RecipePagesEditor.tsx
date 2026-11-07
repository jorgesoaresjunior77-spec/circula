import { useState } from 'react'
import { RECIPE_PAGES_MAX, useRecipePages } from '../hooks/useRecipePages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'

// Profissional: páginas prontas da receita em formato de revista (capa,
// ingredientes, modo de fazer, informação nutricional, prato pronto...).

interface Props {
  contentId: string
  communityId: string
  profileId: string
}

function Thumb({ path }: { path: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img src={url} alt="" className="rec-pages-thumb" /> : <span className="rec-pages-thumb" />
}

export function RecipePagesEditor({ contentId, communityId, profileId }: Props) {
  const { pages, addPage, removePage } = useRecipePages(contentId, communityId)
  const [error, setError] = useState<string | null>(null)
  // Muda a cada página enviada para limpar o campo de upload.
  const [fieldKey, setFieldKey] = useState(0)

  async function handleNew(path: string) {
    if (!path) return
    setError(null)
    const r = await addPage(path)
    if (r.error) setError(r.error)
    else setFieldKey((k) => k + 1)
  }

  async function handleRemove(id: string) {
    setError(null)
    const r = await removePage(id)
    if (r.error) setError(r.error)
  }

  return (
    <fieldset className="rec-pages-editor">
      <legend>Páginas da receita em formato de revista</legend>
      <p className="home-muted">
        Suba as páginas prontas, na ordem: ingredientes, modo de fazer, informação nutricional e prato
        pronto. A foto da receita acima serve de capa. Até {RECIPE_PAGES_MAX} páginas.
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
      {pages.length < RECIPE_PAGES_MAX && (
        <CoverImageInput
          key={fieldKey}
          value=""
          communityId={communityId}
          uid={profileId}
          label="Adicionar página"
          aspectRatio="3 / 4"
          recommendedSize="1080 × 1440 px"
          onChange={(path) => void handleNew(path)}
        />
      )}
      {error && <p className="auth-error">{error}</p>}
    </fieldset>
  )
}
