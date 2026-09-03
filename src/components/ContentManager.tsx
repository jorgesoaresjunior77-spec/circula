import { useState } from 'react'
import type { FormEvent } from 'react'
import { useContent } from '../hooks/useContent'
import { useCircles } from '../hooks/useCircles'
import type {
  CommunityContent,
  ContentInput,
  ContentStatus,
  ContentType,
} from '../types/content'
import { CONTENT_TYPE_LABEL } from '../types/content'
import { ContentCard } from './ContentCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'

interface ContentManagerProps {
  communityId: string
  profileId: string
  /** false = visão somente leitura (Master). */
  canManage?: boolean
  /**
   * Fase 2 — quando true, este gerenciador NÃO trata receitas (elas têm
   * o RecipeManager próprio): o tipo "Receita" some do formulário e as
   * linhas type='recipe' saem da lista. O Master segue com o
   * ContentManager completo (excludeRecipes omitido).
   */
  excludeRecipes?: boolean
}

interface FormState {
  type: ContentType
  title: string
  summary: string
  body: string
  coverImageUrl: string
  externalUrl: string
  category: string
  circleId: string
  status: ContentStatus
}

const EMPTY_FORM: FormState = {
  type: 'article',
  title: '',
  summary: '',
  body: '',
  coverImageUrl: '',
  externalUrl: '',
  category: '',
  circleId: '',
  status: 'published',
}

function formToInput(form: FormState): ContentInput {
  return {
    type: form.type,
    title: form.title,
    summary: form.summary,
    body: form.body,
    cover_image_url: form.coverImageUrl,
    external_url: form.externalUrl,
    category: form.category,
    circle_id: form.circleId || null,
    status: form.status,
  }
}

function formFromItem(item: CommunityContent): FormState {
  return {
    type: item.type,
    title: item.title,
    summary: item.summary ?? '',
    body: item.body ?? '',
    coverImageUrl: item.cover_image_url ?? '',
    externalUrl: item.external_url ?? '',
    category: item.category ?? '',
    circleId: item.circle_id ?? '',
    status: item.status,
  }
}

export function ContentManager({
  communityId,
  profileId,
  canManage = true,
  excludeRecipes = false,
}: ContentManagerProps) {
  const { items, loading, error, createContent, updateContent, deleteContent, toggleLike } =
    useContent(communityId)
  const { circles } = useCircles(communityId)

  const typeKeys = (Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).filter(
    (key) => !excludeRecipes || key !== 'recipe',
  )
  const visibleItems = excludeRecipes ? items.filter((item) => item.type !== 'recipe') : items

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setFormError('Informe o título.')
      return
    }
    setBusy(true)
    setFormError(null)
    const { error: opError } = editingId
      ? await updateContent(editingId, formToInput(form))
      : await createContent(profileId, formToInput(form))
    setBusy(false)
    if (opError) {
      setFormError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    resetForm()
  }

  function startEdit(item: CommunityContent) {
    setEditingId(item.id)
    setForm(formFromItem(item))
    setFormError(null)
  }

  return (
    <section className="community-card community-card--quiet content-manager">
      <h3>{excludeRecipes ? 'Outros conteúdos da comunidade' : 'Biblioteca da comunidade'}</h3>

      {canManage && (
        <form onSubmit={handleSubmit} className="content-form">
          <label htmlFor="content-type">Tipo</label>
          <select
            id="content-type"
            value={form.type}
            onChange={(e) => set('type', e.target.value as ContentType)}
          >
            {typeKeys.map((key) => (
              <option key={key} value={key}>
                {CONTENT_TYPE_LABEL[key]}
              </option>
            ))}
          </select>

          <label htmlFor="content-title">Título</label>
          <input
            id="content-title"
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />

          <label htmlFor="content-summary">Resumo (opcional)</label>
          <input
            id="content-summary"
            type="text"
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
          />

          <label htmlFor="content-body">Conteúdo (opcional)</label>
          <textarea
            id="content-body"
            rows={5}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
          />

          <CoverImageInput
            id="content-cover"
            uid={profileId}
            value={form.coverImageUrl}
            onChange={(url) => set('coverImageUrl', url)}
          />

          <label htmlFor="content-external">Link externo (vídeo/material, opcional)</label>
          <input
            id="content-external"
            type="url"
            value={form.externalUrl}
            onChange={(e) => set('externalUrl', e.target.value)}
            placeholder="https://..."
          />

          <div className="event-form-row">
            <div>
              <label htmlFor="content-category">Categoria (opcional)</label>
              <input
                id="content-category"
                type="text"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="Ex.: café da manhã"
              />
            </div>
            <div>
              <label htmlFor="content-circle">Círculo (opcional)</label>
              <select
                id="content-circle"
                value={form.circleId}
                onChange={(e) => set('circleId', e.target.value)}
              >
                <option value="">Toda a comunidade</option>
                {circles.map((circle) => (
                  <option key={circle.id} value={circle.id}>
                    {circle.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="content-status">Publicação</label>
          <select
            id="content-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ContentStatus)}
          >
            <option value="published">Publicado</option>
            <option value="draft">Rascunho</option>
            <option value="archived">Arquivado</option>
          </select>

          {formError && <p className="auth-error">{formError}</p>}

          <div className="challenge-item-actions">
            {editingId && (
              <button type="button" className="auth-link" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className="challenge-save-button" disabled={busy}>
              {busy ? 'Salvando...' : editingId ? 'Salvar conteúdo' : 'Publicar conteúdo'}
            </button>
          </div>
        </form>
      )}

      {loading && <p>Carregando conteúdos...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}
      {!loading && !error && visibleItems.length === 0 && (
        <EmptyState message="Nenhum conteúdo publicado ainda." />
      )}

      {!loading &&
        !error &&
        visibleItems.map((item) => (
          <div key={item.id} className="content-block">
            <ContentCard
              item={item}
              profileId={profileId}
              circleName={
                item.circle_id
                  ? (circles.find((c) => c.id === item.circle_id)?.name ?? null)
                  : null
              }
              canLike={canManage}
              onToggleLike={(liked) => toggleLike(item.id, profileId, liked)}
            />
            {canManage && (
              <div className="challenge-item-actions">
                <button type="button" onClick={() => startEdit(item)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="challenge-delete-button"
                  onClick={() => deleteContent(item.id)}
                >
                  Excluir
                </button>
              </div>
            )}
          </div>
        ))}
    </section>
  )
}
