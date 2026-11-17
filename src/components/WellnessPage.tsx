import { useState } from 'react'
import type { FormEvent } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { ARTICLE_MAX_IMAGES, ARTICLE_MIN_IMAGES, layoutArticle, splitParagraphs } from '../lib/wellnessArticles'
import type { WellnessArticle } from '../lib/wellnessArticles'
import { CoverImageInput } from './CoverImageInput'
import { MultiPageUpload } from './MultiPageUpload'

// Wellness: matérias da profissional sobre o mundo do bem-estar. A membro vê
// os cartões (3 por fila, como nas outras páginas) e abre a matéria inteira,
// com as imagens espalhadas pelo texto. A profissional cadastra título,
// descrição, a matéria e pelo menos 3 imagens.

interface Props {
  communityId: string
  profileId: string
  isOwner: boolean
}

interface FormState {
  id: string | null
  title: string
  description: string
  body: string
  cover: string
  images: string[]
  status: 'draft' | 'published'
}

const EMPTY: FormState = { id: null, title: '', description: '', body: '', cover: '', images: [], status: 'draft' }

function Img({ path, className, alt = '' }: { path: string | null; className: string; alt?: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />
  ) : (
    <span className={`${className} ${className}--blank`} aria-hidden="true" />
  )
}

function ArticleTile({ article, onOpen }: { article: WellnessArticle; onOpen: () => void }) {
  const cover = article.cover_path ?? article.image_paths[0] ?? null
  return (
    <button type="button" className="reading-tile wellness-tile" onClick={onOpen}>
      <Img path={cover} className="reading-tile-cover wellness-tile-cover" />
      <span className="reading-tile-title">{article.title}</span>
      {article.description && <span className="reading-tile-author">{article.description}</span>}
      {article.status === 'draft' && <span className="reading-draft">Rascunho</span>}
    </button>
  )
}

function ArticleReader({
  article,
  onClose,
  onEdit,
}: {
  article: WellnessArticle
  onClose: () => void
  onEdit?: () => void
}) {
  const blocks = layoutArticle(splitParagraphs(article.body), article.image_paths)
  return (
    <div className="reading-detail-backdrop" role="dialog" aria-modal="true" aria-label={article.title} onClick={onClose}>
      <article className="reading-detail wellness-reader" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="reading-detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        {article.cover_path && <Img path={article.cover_path} className="wellness-reader-cover" alt="" />}
        <h3 className="wellness-reader-title">{article.title}</h3>
        {article.description && <p className="wellness-reader-lead">{article.description}</p>}
        {article.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
        {blocks.map((b, i) =>
          b.type === 'text' ? (
            <p key={i} className="wellness-reader-text">
              {b.text}
            </p>
          ) : (
            <Img key={i} path={b.path} className="wellness-reader-img" />
          ),
        )}
        {onEdit && (
          <button type="button" className="water-link" onClick={onEdit}>
            Editar
          </button>
        )}
      </article>
    </div>
  )
}

export function WellnessPage({ communityId, profileId, isOwner }: Props) {
  const { items, loading, error, save, remove } = useManagedContent<WellnessArticle>(
    'wellness_articles',
    communityId,
    'created_at',
  )
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const openArticle = items.find((i) => i.id === openId) ?? null

  function openEdit(a: WellnessArticle) {
    setOpenId(null)
    setForm({
      id: a.id,
      title: a.title,
      description: a.description ?? '',
      body: a.body ?? '',
      cover: a.cover_path ?? '',
      images: a.image_paths,
      status: a.status,
    })
    setFormError(null)
    setConfirmDelete(false)
  }

  function closeForm() {
    setForm(null)
    setFormError(null)
    setConfirmDelete(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) {
      setFormError('Dê um título à matéria.')
      return
    }
    if (form.status === 'published' && form.images.length < ARTICLE_MIN_IMAGES) {
      setFormError(`Para publicar, coloque pelo menos ${ARTICLE_MIN_IMAGES} imagens na matéria.`)
      return
    }
    setSaving(true)
    const r = await save(form.id, {
      title: form.title.trim(),
      description: form.description.trim() || null,
      body: form.body.trim() || null,
      cover_path: form.cover || null,
      image_paths: form.images,
      status: form.status,
    })
    setSaving(false)
    if (r.error) {
      setFormError(r.error)
      return
    }
    closeForm()
  }

  async function handleDelete() {
    if (!form?.id) return
    setSaving(true)
    const r = await remove(form.id)
    setSaving(false)
    if (r.error) {
      setFormError(r.error)
      return
    }
    closeForm()
  }

  function moveImage(from: number, to: number) {
    if (!form || to < 0 || to >= form.images.length) return
    const next = [...form.images]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setForm({ ...form, images: next })
  }

  return (
    <section className="reading-page wellness-page">
      <h2>Wellness</h2>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="home-muted">
          {isOwner
            ? 'Você ainda não escreveu nenhuma matéria. Use o botão abaixo para começar.'
            : 'As matérias do Wellness ainda não foram publicadas. Em breve, novidades por aqui.'}
        </p>
      )}

      {items.length > 0 && (
        <div className="reading-grid">
          {[...items].reverse().map((a) => (
            <ArticleTile key={a.id} article={a} onOpen={() => setOpenId(a.id)} />
          ))}
        </div>
      )}

      {openArticle && (
        <ArticleReader
          article={openArticle}
          onClose={() => setOpenId(null)}
          onEdit={isOwner ? () => openEdit(openArticle) : undefined}
        />
      )}

      {isOwner && !form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Nova matéria
        </button>
      )}

      {isOwner && form && (
        <form className="wellness-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar matéria' : 'Nova matéria'}>
          <h3>{form.id ? 'Editar matéria' : 'Nova matéria'}</h3>
          <label>
            Título
            <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Descrição (aparece no cartão)
            <textarea rows={2} maxLength={400} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Matéria
            <textarea
              className="wellness-body-input"
              rows={14}
              maxLength={20000}
              placeholder="Escreva a matéria completa. Deixe uma linha em branco entre os parágrafos."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <CoverImageInput
            id="wellness-cover"
            communityId={communityId}
            uid={profileId}
            value={form.cover}
            onChange={(path) => setForm({ ...form, cover: path })}
            label="Capa do cartão"
            aspectRatio="2 / 3"
            recommendedSize="800 × 1200 px"
          />

          <fieldset className="rec-pages-editor">
            <legend>
              Imagens da matéria ({form.images.length}/{ARTICLE_MAX_IMAGES}) — pelo menos {ARTICLE_MIN_IMAGES}
            </legend>
            <p className="home-muted">
              As imagens aparecem distribuídas ao longo do texto, na ordem abaixo. Escolha várias de uma vez.
            </p>
            <ol className="rec-pages-list">
              {form.images.map((path, i) => (
                <li key={path}>
                  <Img path={path} className="rec-pages-thumb" />
                  <span>Imagem {i + 1}</span>
                  <button type="button" className="auth-link" onClick={() => moveImage(i, i - 1)} disabled={i === 0}>
                    Subir
                  </button>
                  <button type="button" className="auth-link" onClick={() => moveImage(i, i + 1)} disabled={i === form.images.length - 1}>
                    Descer
                  </button>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ol>
            {form.images.length < ARTICLE_MAX_IMAGES && (
              <MultiPageUpload
                communityId={communityId}
                uid={profileId}
                label="Enviar imagens da matéria"
                onUploaded={async (paths) => {
                  setForm((f) => (f ? { ...f, images: [...f.images, ...paths].slice(0, ARTICLE_MAX_IMAGES) } : f))
                  return null
                }}
              />
            )}
          </fieldset>

          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
              <option value="draft">Rascunho (só você vê)</option>
              <option value="published">Publicado para a comunidade</option>
            </select>
          </label>
          {formError && <p className="auth-error">{formError}</p>}
          <div className="wellness-form-actions">
            <button type="submit" className="water-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="water-link" onClick={closeForm} disabled={saving}>
              Cancelar
            </button>
            {form.id &&
              (confirmDelete ? (
                <button type="button" className="agenda-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" className="agenda-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Excluir
                </button>
              ))}
          </div>
        </form>
      )}
    </section>
  )
}
