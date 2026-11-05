import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import type { Recipe, RecipeCategory } from '../hooks/useRecipes'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'

interface RecipesPageProps {
  communityId: string
  profileId: string
  isOwner: boolean
}

function Photo({ path }: { path: string | null }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img src={url} alt="" loading="lazy" decoding="async" /> : null
}

function CategoryCard({
  cat,
  count,
  onOpen,
}: {
  cat: RecipeCategory
  count: number
  onOpen: () => void
}) {
  return (
    <button type="button" className="rec-card" onClick={onOpen}>
      <span className="rec-card-media">
        <Photo path={cat.cover_path} />
      </span>
      <span className="rec-card-body">
        <strong>{cat.name}</strong>
        {cat.description && <span className="rec-card-desc">{cat.description}</span>}
        <span className="rec-card-meta">
          {count} {count === 1 ? 'receita' : 'receitas'}
        </span>
      </span>
    </button>
  )
}

function RecipeCard({
  recipe,
  views,
  onOpen,
}: {
  recipe: Recipe
  views?: number
  onOpen: () => void
}) {
  return (
    <button type="button" className="rec-card" onClick={onOpen}>
      <span className="rec-card-media">
        <Photo path={recipe.cover_image_url} />
      </span>
      <span className="rec-card-body">
        <strong>{recipe.title}</strong>
        {recipe.summary && <span className="rec-card-desc">{recipe.summary}</span>}
        {views !== undefined && (
          <span className="rec-card-meta">
            {views} {views === 1 ? 'visualização' : 'visualizações'}
            {recipe.status !== 'published' ? ' · rascunho' : ''}
          </span>
        )}
      </span>
    </button>
  )
}

export function RecipesPage({ communityId, profileId, isOwner }: RecipesPageProps) {
  const api = useRecipes(communityId, profileId, isOwner)
  const [catId, setCatId] = useState<string | null>(null)
  const [open, setOpen] = useState<Recipe | null>(null)
  const [editCat, setEditCat] = useState<Partial<RecipeCategory> | null>(null)
  const [editRec, setEditRec] = useState<Partial<Recipe> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const category = api.categories.find((c) => c.id === catId) ?? null
  const inCategory = (id: string | null) => api.recipes.filter((r) => r.category_id === id)

  function openRecipe(r: Recipe) {
    setOpen(r)
    void api.recordView(r.id)
  }

  async function submitCat(e: FormEvent) {
    e.preventDefault()
    if (!editCat?.name?.trim()) return
    const r = await api.saveCategory({
      id: editCat.id,
      name: editCat.name,
      description: editCat.description ?? '',
      cover_path: editCat.cover_path ?? '',
    })
    if (r.error) setError('Não foi possível salvar a categoria.')
    else {
      setError(null)
      setEditCat(null)
    }
  }

  async function submitRec(e: FormEvent) {
    e.preventDefault()
    if (!editRec?.title?.trim()) return
    const r = await api.saveRecipe({
      id: editRec.id,
      title: editRec.title,
      summary: editRec.summary ?? '',
      ingredients: editRec.ingredients ?? '',
      body: editRec.body ?? '',
      cover: editRec.cover_image_url ?? '',
      category_id: editRec.category_id ?? category?.id ?? null,
      status: editRec.status === 'draft' ? 'draft' : 'published',
    })
    if (r.error) setError('Não foi possível salvar a receita.')
    else {
      setError(null)
      setEditRec(null)
      setOpen(null)
    }
  }

  // ---- formulário de categoria ----
  if (editCat) {
    return (
      <form className="rec-page rec-form" onSubmit={submitCat}>
        <h2>{editCat.id ? 'Editar categoria' : 'Nova categoria'}</h2>
        <label>
          Nome
          <input
            value={editCat.name ?? ''}
            onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
            placeholder="Ex.: Sem glúten"
          />
        </label>
        <label>
          Descrição
          <textarea
            rows={3}
            value={editCat.description ?? ''}
            onChange={(e) => setEditCat({ ...editCat, description: e.target.value })}
          />
        </label>
        <CoverImageInput
          value={editCat.cover_path ?? ''}
          communityId={communityId}
          uid={profileId}
          label="Imagem da categoria"
          aspectRatio="4 / 5"
          recommendedSize="1080 × 1350 px"
          onChange={(p) => setEditCat({ ...editCat, cover_path: p })}
        />
        {error && <p className="auth-error">{error}</p>}
        <div className="rec-actions">
          <button type="button" className="auth-link" onClick={() => setEditCat(null)}>
            Cancelar
          </button>
          {editCat.id && (
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                if (window.confirm('Excluir categoria? As receitas ficam sem categoria.')) {
                  void api.deleteCategory(editCat.id as string).then(() => {
                    setEditCat(null)
                    setCatId(null)
                  })
                }
              }}
            >
              Excluir
            </button>
          )}
          <button type="submit" className="profile-save-action">
            Salvar
          </button>
        </div>
      </form>
    )
  }

  // ---- formulário de receita ----
  if (editRec) {
    return (
      <form className="rec-page rec-form" onSubmit={submitRec}>
        <h2>{editRec.id ? 'Editar receita' : 'Nova receita'}</h2>
        <label>
          Título
          <input
            value={editRec.title ?? ''}
            onChange={(e) => setEditRec({ ...editRec, title: e.target.value })}
          />
        </label>
        <label>
          Categoria
          <select
            value={editRec.category_id ?? category?.id ?? ''}
            onChange={(e) => setEditRec({ ...editRec, category_id: e.target.value || null })}
          >
            <option value="">Sem categoria</option>
            {api.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descrição curta
          <textarea
            rows={2}
            value={editRec.summary ?? ''}
            onChange={(e) => setEditRec({ ...editRec, summary: e.target.value })}
          />
        </label>
        <label>
          Ingredientes
          <textarea
            rows={5}
            value={editRec.ingredients ?? ''}
            onChange={(e) => setEditRec({ ...editRec, ingredients: e.target.value })}
          />
        </label>
        <label>
          Modo de preparo
          <textarea
            rows={6}
            value={editRec.body ?? ''}
            onChange={(e) => setEditRec({ ...editRec, body: e.target.value })}
          />
        </label>
        <CoverImageInput
          value={editRec.cover_image_url ?? ''}
          communityId={communityId}
          uid={profileId}
          label="Foto da receita"
          aspectRatio="4 / 5"
          recommendedSize="1080 × 1350 px"
          onChange={(p) => setEditRec({ ...editRec, cover_image_url: p })}
        />
        <label className="rec-check">
          <input
            type="checkbox"
            checked={editRec.status !== 'draft'}
            onChange={(e) =>
              setEditRec({ ...editRec, status: e.target.checked ? 'published' : 'draft' })
            }
          />
          Publicada (visível às participantes)
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div className="rec-actions">
          <button type="button" className="auth-link" onClick={() => setEditRec(null)}>
            Cancelar
          </button>
          <button type="submit" className="profile-save-action">
            Salvar
          </button>
        </div>
      </form>
    )
  }

  // ---- detalhe da receita ----
  if (open) {
    const fresh = api.recipes.find((r) => r.id === open.id) ?? open
    return (
      <section className="rec-page">
        <button type="button" className="auth-link" onClick={() => setOpen(null)}>
          ← Voltar
        </button>
        <div className="rec-detail-media">
          <Photo path={fresh.cover_image_url} />
        </div>
        <h2>{fresh.title}</h2>
        {fresh.summary && <p>{fresh.summary}</p>}
        {fresh.ingredients && (
          <>
            <h3>Ingredientes</h3>
            <p className="rec-pre">{fresh.ingredients}</p>
          </>
        )}
        {fresh.body && (
          <>
            <h3>Modo de preparo</h3>
            <p className="rec-pre">{fresh.body}</p>
          </>
        )}
        {isOwner && (
          <div className="rec-actions">
            <span className="rec-card-meta">{api.views[fresh.id] ?? 0} visualizações</span>
            <button
              type="button"
              className="profile-secondary-action"
              onClick={() => setEditRec({ ...fresh })}
            >
              Editar
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                if (window.confirm('Excluir esta receita?')) {
                  void api.deleteRecipe(fresh.id).then(() => setOpen(null))
                }
              }}
            >
              Excluir
            </button>
          </div>
        )}
      </section>
    )
  }

  // ---- receitas de uma categoria ----
  if (catId) {
    const list = catId === 'sem-categoria' ? inCategory(null) : inCategory(catId)
    return (
      <section className="rec-page">
        <button type="button" className="auth-link" onClick={() => setCatId(null)}>
          ← Categorias
        </button>
        <h2>{category?.name ?? 'Outras receitas'}</h2>
        {category?.description && <p>{category.description}</p>}
        {isOwner && (
          <div className="rec-actions">
            <button
              type="button"
              className="profile-edit-action"
              onClick={() => setEditRec({ category_id: category?.id ?? null, status: 'published' })}
            >
              + Nova receita
            </button>
            {category && (
              <button
                type="button"
                className="profile-secondary-action"
                onClick={() => setEditCat({ ...category })}
              >
                Editar categoria
              </button>
            )}
          </div>
        )}
        {list.length === 0 && <p className="home-muted">Nenhuma receita aqui ainda.</p>}
        <div className="rec-grid">
          {list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              views={isOwner ? (api.views[r.id] ?? 0) : undefined}
              onOpen={() => openRecipe(r)}
            />
          ))}
        </div>
      </section>
    )
  }

  // ---- categorias ----
  const uncategorized = inCategory(null)
  return (
    <section className="rec-page">
      <h2>Receitas</h2>
      {isOwner && (
        <div className="rec-actions">
          <button type="button" className="profile-edit-action" onClick={() => setEditCat({})}>
            + Nova categoria
          </button>
        </div>
      )}
      {api.loading && <p className="home-muted">Carregando…</p>}
      {!api.loading && api.categories.length === 0 && uncategorized.length === 0 && (
        <p className="home-muted">
          {isOwner
            ? 'Crie a primeira categoria (ex.: Sem glúten, Saladas).'
            : 'Em breve novas receitas por aqui.'}
        </p>
      )}
      <div className="rec-grid">
        {api.categories.map((c) => (
          <CategoryCard
            key={c.id}
            cat={c}
            count={inCategory(c.id).length}
            onOpen={() => setCatId(c.id)}
          />
        ))}
        {uncategorized.length > 0 && (
          <CategoryCard
            cat={{
              id: 'sem-categoria',
              name: 'Outras receitas',
              description: null,
              cover_path: null,
              position: 999,
            }}
            count={uncategorized.length}
            onOpen={() => setCatId('sem-categoria')}
          />
        )}
      </div>
    </section>
  )
}
