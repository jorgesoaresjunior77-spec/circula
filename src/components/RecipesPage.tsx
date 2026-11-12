import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import type { Recipe, RecipeCategory } from '../hooks/useRecipes'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'
import { RecipeMagazineView } from './RecipeMagazineView'
import { RecipePagesEditor } from './RecipePagesEditor'
import { ChevronLeftIcon } from './icons'
import { isList, recipeItems } from '../lib/recipeText'

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
  index,
  onOpen,
}: {
  cat: RecipeCategory
  count: number
  index: number
  onOpen: () => void
}) {
  return (
    <button type="button" className="rec-tile" style={{ '--i': index } as CSSProperties} onClick={onOpen}>
      <span className="rec-tile-media" aria-hidden="true">
        <Photo path={cat.cover_path} />
      </span>
      <span className="rec-tile-veil" aria-hidden="true" />
      <span className="rec-tile-body">
        <strong className="rec-tile-title">{cat.name}</strong>
        {cat.description && <span className="rec-tile-desc">{cat.description}</span>}
        <span className="rec-pill">
          {count} {count === 1 ? 'receita' : 'receitas'}
        </span>
      </span>
    </button>
  )
}

function RecipeRow({
  recipe,
  views,
  index,
  onOpen,
}: {
  recipe: Recipe
  views?: number
  index: number
  onOpen: () => void
}) {
  const draft = recipe.status !== 'published'
  return (
    <button type="button" className="rec-row" style={{ '--i': index } as CSSProperties} onClick={onOpen}>
      <span className="rec-row-thumb" aria-hidden="true">
        <Photo path={recipe.cover_image_url} />
      </span>
      <span className="rec-row-body">
        <strong className="rec-row-title">{recipe.title}</strong>
        {recipe.summary && <span className="rec-row-desc">{recipe.summary}</span>}
        {(views !== undefined || draft) && (
          <span className="rec-row-meta">
            {draft && <span className="rec-chip">Rascunho</span>}
            {views !== undefined && (
              <span>
                {views} {views === 1 ? 'visualização' : 'visualizações'}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="rec-row-go" aria-hidden="true">
        ›
      </span>
    </button>
  )
}

function BackButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <ChevronLeftIcon size={18} /> {children}
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
  const [notice, setNotice] = useState<string | null>(null)

  const category = api.categories.find((c) => c.id === catId) ?? null
  const inCategory = (id: string | null) => api.recipes.filter((r) => r.category_id === id)

  function openRecipe(r: Recipe) {
    setOpen(r)
    void api.recordView(r.id)
  }

  async function submitCat(e: FormEvent) {
    e.preventDefault()
    if (!editCat?.name?.trim()) {
      setError('Escreva o nome da categoria para salvar.')
      return
    }
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
    if (!editRec?.title?.trim()) {
      setError('Escreva o título da receita para salvar.')
      return
    }
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
    if (r.error) {
      setError('Não foi possível salvar a receita.')
      return
    }
    setError(null)
    if (!editRec.id && r.id) {
      // Receita nova: fica no formulário, agora com as páginas liberadas.
      const newId = r.id
      setEditRec((prev) => ({ ...(prev ?? {}), id: newId }))
      setNotice('Receita salva. Agora você pode adicionar as páginas em formato de revista, logo abaixo.')
      return
    }
    setNotice(null)
    setEditRec(null)
    setOpen(null)
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
            onChange={(e) => setEditCat((prev) => ({ ...(prev ?? {}), name: e.target.value }))}
            placeholder="Ex.: Sem glúten"
          />
        </label>
        <label>
          Descrição
          <textarea
            rows={3}
            value={editCat.description ?? ''}
            onChange={(e) => setEditCat((prev) => ({ ...(prev ?? {}), description: e.target.value }))}
          />
        </label>
        <CoverImageInput
          value={editCat.cover_path ?? ''}
          communityId={communityId}
          uid={profileId}
          label="Imagem da categoria"
          aspectRatio="4 / 5"
          recommendedSize="1080 × 1350 px"
          onChange={(p) => setEditCat((prev) => ({ ...(prev ?? {}), cover_path: p }))}
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
            onChange={(e) => setEditRec((prev) => ({ ...(prev ?? {}), title: e.target.value }))}
          />
        </label>
        <label>
          Categoria
          <select
            value={editRec.category_id ?? category?.id ?? ''}
            onChange={(e) => setEditRec((prev) => ({ ...(prev ?? {}), category_id: e.target.value || null }))}
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
            onChange={(e) => setEditRec((prev) => ({ ...(prev ?? {}), summary: e.target.value }))}
          />
        </label>
        <label>
          Ingredientes
          <textarea
            rows={5}
            value={editRec.ingredients ?? ''}
            onChange={(e) => setEditRec((prev) => ({ ...(prev ?? {}), ingredients: e.target.value }))}
          />
        </label>
        <label>
          Modo de preparo
          <textarea
            rows={6}
            value={editRec.body ?? ''}
            onChange={(e) => setEditRec((prev) => ({ ...(prev ?? {}), body: e.target.value }))}
          />
        </label>
        <CoverImageInput
          value={editRec.cover_image_url ?? ''}
          communityId={communityId}
          uid={profileId}
          label="Foto da receita"
          aspectRatio="4 / 5"
          recommendedSize="1080 × 1350 px"
          onChange={(p) => setEditRec((prev) => ({ ...(prev ?? {}), cover_image_url: p }))}
        />
        {editRec.id ? (
          <RecipePagesEditor contentId={editRec.id} communityId={communityId} profileId={profileId} />
        ) : (
          <p className="home-muted">Salve a receita para adicionar as páginas em formato de revista.</p>
        )}
        <label className="rec-check">
          <input
            type="checkbox"
            checked={editRec.status !== 'draft'}
            onChange={(e) =>
              setEditRec((prev) => ({ ...(prev ?? {}), status: e.target.checked ? 'published' : 'draft' }))
            }
          />
          Publicada (visível às participantes)
        </label>
        {notice && (
          <p className="auth-success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="rec-actions">
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setEditRec(null)
              setNotice(null)
              setError(null)
            }}
          >
            {notice ? 'Concluir' : 'Cancelar'}
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
    const categoryName = api.categories.find((c) => c.id === fresh.category_id)?.name ?? null
    const ingredients = recipeItems(fresh.ingredients)
    const steps = recipeItems(fresh.body, { steps: true })
    return (
      <section className="rec-page rec-detail">
        <BackButton onClick={() => setOpen(null)}>Voltar</BackButton>
        <div className="rec-hero">
          <Photo path={fresh.cover_image_url} />
        </div>
        <header className="rec-head">
          {categoryName && <p className="rec-eyebrow">{categoryName}</p>}
          <h2>{fresh.title}</h2>
          {fresh.summary && <p className="rec-lead">{fresh.summary}</p>}
        </header>
        <RecipeMagazineView
          recipeId={fresh.id}
          communityId={communityId}
          title={fresh.title}
          coverPath={fresh.cover_image_url}
        />
        {fresh.ingredients && (
          <article className="rec-block">
            <h3>Ingredientes</h3>
            {isList(ingredients) ? (
              <ul className="rec-ingredients">
                {ingredients.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="rec-pre">{fresh.ingredients}</p>
            )}
          </article>
        )}
        {fresh.body && (
          <article className="rec-block">
            <h3>Modo de preparo</h3>
            {isList(steps) ? (
              <ol className="rec-steps">
                {steps.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            ) : (
              <p className="rec-pre">{fresh.body}</p>
            )}
          </article>
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
        <BackButton onClick={() => setCatId(null)}>Categorias</BackButton>
        <header className="rec-head">
          <p className="rec-eyebrow">Receitas</p>
          <h2>{category?.name ?? 'Outras receitas'}</h2>
          {category?.description && <p className="rec-lead">{category.description}</p>}
        </header>
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
        <div className="rec-list">
          {list.map((r, i) => (
            <RecipeRow
              key={r.id}
              recipe={r}
              index={i}
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
      <header className="rec-head">
        <p className="rec-eyebrow">Biblioteca</p>
        <h2>Receitas</h2>
        {api.categories.length > 0 && <p className="rec-lead">Escolha uma categoria para ver as receitas.</p>}
      </header>
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
        {api.categories.map((c, i) => (
          <CategoryCard
            key={c.id}
            cat={c}
            count={inCategory(c.id).length}
            index={i}
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
            index={api.categories.length}
            onOpen={() => setCatId('sem-categoria')}
          />
        )}
      </div>
    </section>
  )
}
