import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import type { CommunityContent, ContentStatus, RecipeInput } from '../types/content'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_FALLBACK } from '../types/content'
import { CoverImageInput } from './CoverImageInput'
import { RecipeCard } from './RecipeCard'
import { RecipeView } from './RecipeView'
import { EmptyState } from './EmptyState'

// Fase 2 — gerenciamento de RECEITAS para a anfitriã.
// Cadastro simples e direto: título, descrição, foto, ingredientes,
// (modo de preparo opcional), categoria e publicação. Reaproveita
// CoverImageInput (upload já existente), RecipeCard/RecipeView (visão da
// usuária) e as classes de ação já usadas em Desafios/Círculos. Sem tela
// nova, sem passo extra.

interface RecipeManagerProps {
  communityId: string
  profileId: string
  /** false = só leitura (não usado hoje: Master mantém o ContentManager). */
  canManage?: boolean
}

interface FormState {
  title: string
  summary: string
  coverImageUrl: string
  ingredients: string
  body: string
  category: string
  status: ContentStatus
}

const EMPTY_FORM: FormState = {
  title: '',
  summary: '',
  coverImageUrl: '',
  ingredients: '',
  body: '',
  category: RECIPE_CATEGORY_FALLBACK,
  status: 'published',
}

function formToInput(form: FormState): RecipeInput {
  return {
    title: form.title,
    summary: form.summary,
    cover_image_url: form.coverImageUrl,
    ingredients: form.ingredients,
    body: form.body,
    category: form.category,
    status: form.status,
  }
}

function formFromRecipe(recipe: CommunityContent): FormState {
  return {
    title: recipe.title,
    summary: recipe.summary ?? '',
    coverImageUrl: recipe.cover_image_url ?? '',
    ingredients: recipe.ingredients ?? '',
    body: recipe.body ?? '',
    category: recipe.category ?? RECIPE_CATEGORY_FALLBACK,
    status: recipe.status,
  }
}

export function RecipeManager({ communityId, profileId, canManage = true }: RecipeManagerProps) {
  const { recipes, loading, error, createRecipe, updateRecipe, deleteRecipe } =
    useRecipes(communityId)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
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
      setFormError('Informe o título da receita.')
      return
    }
    setBusy(true)
    setFormError(null)
    const { error: opError } = editingId
      ? await updateRecipe(editingId, formToInput(form))
      : await createRecipe(profileId, formToInput(form))
    setBusy(false)
    if (opError) {
      setFormError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    resetForm()
  }

  function startEdit(recipe: CommunityContent) {
    setEditingId(recipe.id)
    setForm(formFromRecipe(recipe))
    setFormError(null)
    setPreviewId(null)
  }

  const preview = previewId ? (recipes.find((r) => r.id === previewId) ?? null) : null

  return (
    <section className="community-card community-card--quiet recipe-manager">
      <h3>Receitas da comunidade</h3>

      {preview ? (
        <RecipeView recipe={preview} onBack={() => setPreviewId(null)} />
      ) : (
        <>
          {canManage && (
            <form onSubmit={handleSubmit} className="recipe-form">
              <label htmlFor="recipe-title">Título da receita</label>
              <input
                id="recipe-title"
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ex.: Panqueca de banana e aveia"
                required
              />

              <label htmlFor="recipe-summary">Descrição / legenda (opcional)</label>
              <input
                id="recipe-summary"
                type="text"
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                placeholder="Uma linha simples sobre a receita"
              />

              <CoverImageInput
                id="recipe-cover"
                uid={profileId}
                label="Foto da receita (opcional)"
                value={form.coverImageUrl}
                onChange={(url) => set('coverImageUrl', url)}
              />

              <label htmlFor="recipe-ingredients">Ingredientes (um por linha)</label>
              <textarea
                id="recipe-ingredients"
                rows={6}
                value={form.ingredients}
                onChange={(e) => set('ingredients', e.target.value)}
                placeholder={'1 banana\n2 colheres de aveia\n1 ovo'}
              />

              <label htmlFor="recipe-body">Modo de preparo (opcional)</label>
              <textarea
                id="recipe-body"
                rows={5}
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder="Explique o passo a passo, se quiser."
              />

              <label htmlFor="recipe-category">Categoria</label>
              <select
                id="recipe-category"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label htmlFor="recipe-status">Publicação</label>
              <select
                id="recipe-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as ContentStatus)}
              >
                <option value="published">Publicada</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivada</option>
              </select>

              {formError && <p className="auth-error">{formError}</p>}

              <div className="challenge-item-actions">
                {editingId && (
                  <button type="button" className="auth-link" onClick={resetForm}>
                    Cancelar edição
                  </button>
                )}
                <button type="submit" className="challenge-save-button" disabled={busy}>
                  {busy
                    ? 'Salvando...'
                    : editingId
                      ? 'Salvar receita'
                      : 'Publicar receita'}
                </button>
              </div>
            </form>
          )}

          {loading && <p>Carregando receitas...</p>}
          {!loading && error && <p className="auth-error">{error}</p>}
          {!loading && !error && recipes.length === 0 && (
            <EmptyState message="Nenhuma receita cadastrada ainda." />
          )}

          {!loading && !error && recipes.length > 0 && (
            <div className="recipe-manager-list">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="recipe-manager-item">
                  <RecipeCard
                    recipe={recipe}
                    showStatus
                    onOpen={() => setPreviewId(recipe.id)}
                  />
                  {canManage && (
                    <div className="challenge-item-actions">
                      <button type="button" onClick={() => startEdit(recipe)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="challenge-delete-button"
                        onClick={() => deleteRecipe(recipe.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
