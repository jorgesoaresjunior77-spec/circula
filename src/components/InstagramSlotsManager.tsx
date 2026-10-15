import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useContent } from '../hooks/useContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { isInstagramUrl } from '../lib/instagramContent'
import type { CommunityContent } from '../types/content'

// Ajustes de navegação (item 5C) — "Imagens da comunidade" > Publicações
// do Instagram.
//
// Reaproveita 100% `community_content` (mesma tabela de sempre, sem
// migration nova): cada espaço é um item publicado com `external_url`
// do Instagram. Diferença em relação à Biblioteca/ContentManager: aqui
// a Profissional só informa o LINK — nenhum campo de imagem, título ou
// descrição aparece. Por baixo, o item é salvo com título vazio e sem
// capa (a Home já lida bem com os dois ausentes, ver HomeInstagramStrip
// e InstagramCard). 6 espaços fixos, numerados 1–6: os já cadastrados
// aparecem na ordem em que foram criados; o próximo link preenchido
// sempre ocupa o primeiro espaço vazio.

const TOTAL_SLOTS = 6

interface InstagramSlotsManagerProps {
  communityId: string
  profileId: string
}

function slotPreviewLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/\/+$/, '') || parsed.hostname
  } catch {
    return url
  }
}

interface SlotProps {
  index: number
  item: CommunityContent | null
  onSave: (url: string) => Promise<{ error: string | null }>
  onRemove: () => Promise<{ error: string | null }>
}

function InstagramSlot({ index, item, onSave, onRemove }: SlotProps) {
  const { url: coverUrl } = useSignedImageUrl(item?.cover_image_url ?? null)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(item?.external_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEmpty = !item
  const showForm = isEmpty || editing

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!isInstagramUrl(trimmed)) {
      setError('Cole um link de uma publicação do Instagram.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await onSave(trimmed)
    setBusy(false)
    if (result.error) {
      setError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    setEditing(false)
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    const result = await onRemove()
    setBusy(false)
    if (result.error) {
      setError('Não foi possível remover agora. Tente novamente.')
      return
    }
    setUrl('')
  }

  return (
    <li className="card-images-row">
      <div className="card-images-info">
        <span className="card-images-name">Espaço {index + 1}</span>
      </div>

      <div className="card-images-field">
        {!showForm && item && (
          <div className="insta-slot-preview">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="insta-slot-preview-img" />
            ) : (
              <span className="insta-slot-preview-placeholder" aria-hidden="true">
                Instagram
              </span>
            )}
            <span className="insta-slot-preview-link">{slotPreviewLabel(item.external_url ?? '')}</span>
            <div className="insta-slot-preview-actions">
              <button
                type="button"
                className="panel-content-action"
                onClick={() => {
                  setUrl(item.external_url ?? '')
                  setEditing(true)
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="panel-content-action panel-content-action--delete"
                onClick={handleRemove}
                disabled={busy}
              >
                {busy ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <form className="insta-slot-form" onSubmit={handleSubmit}>
            <input
              type="url"
              className="insta-slot-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              aria-label={`Link do Instagram — espaço ${index + 1}`}
            />
            <div className="insta-slot-form-actions">
              {editing && (
                <button
                  type="button"
                  className="panel-content-action"
                  onClick={() => {
                    setEditing(false)
                    setUrl(item?.external_url ?? '')
                    setError(null)
                  }}
                >
                  Cancelar
                </button>
              )}
              <button type="submit" className="panel-content-submit" disabled={busy || !url.trim()}>
                {busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="card-images-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

export function InstagramSlotsManager({ communityId, profileId }: InstagramSlotsManagerProps) {
  const { items, loading, error, createContent, updateContent, deleteContent } =
    useContent(communityId)

  // Slots 1–6 na ordem de criação (o mais antigo é o Espaço 1); o
  // próximo link cadastrado ocupa sempre o primeiro espaço livre.
  const slotItems = useMemo(() => {
    const instagram = items
      .filter((item) => item.status === 'published' && isInstagramUrl(item.external_url))
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    return Array.from({ length: TOTAL_SLOTS }, (_, i) => instagram[i] ?? null)
  }, [items])

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Publicações do Instagram</h4>
        <p className="card-images-desc">
          Cole o link de cada publicação. Só o link — sem imagem, título ou
          descrição.
        </p>
      </header>

      {loading && <p className="home-muted">Carregando…</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && (
        <ul className="card-images-list">
          {slotItems.map((item, index) => (
            <InstagramSlot
              key={item?.id ?? `empty-${index}`}
              index={index}
              item={item}
              onSave={async (url) => {
                if (item) {
                  return updateContent(item.id, {
                    type: item.type,
                    title: item.title,
                    summary: item.summary,
                    body: item.body,
                    cover_image_url: item.cover_image_url,
                    external_url: url,
                    category: item.category,
                    status: 'published',
                  })
                }
                return createContent(profileId, {
                  type: 'tip',
                  title: '',
                  cover_image_url: null,
                  external_url: url,
                  category: 'Instagram',
                  status: 'published',
                })
              }}
              onRemove={async () => {
                if (!item) return { error: null }
                return deleteContent(item.id)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
