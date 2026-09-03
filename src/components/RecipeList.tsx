import { useMemo, useState } from 'react'
import type { CommunityContent } from '../types/content'
import { RECIPE_CATEGORIES } from '../types/content'
import { RecipeCard } from './RecipeCard'
import { RecipeView } from './RecipeView'
import { EmptyState } from './EmptyState'

// Fase 2 — área de RECEITAS na visão da usuária.
// "Biblioteca" NÃO volta como conceito: para a usuária isto é só
// "Receitas". Cabeçalho claro, filtro por categoria em botões grandes e
// uma grade de cards com foto. Ao abrir um card, mostra a RecipeView no
// lugar da grade (sem rota nova).

interface RecipeListProps {
  recipes: CommunityContent[]
  loading: boolean
  error: string | null
  /** Rótulo opcional de comunidade (quando a usuária participa de mais de uma). */
  communityName?: string
  /** true para a anfitriã: também vê rascunhos/arquivadas com selo. */
  canSeeUnpublished?: boolean
}

const ALL = 'Todas'

export function RecipeList({
  recipes,
  loading,
  error,
  communityName,
  canSeeUnpublished = false,
}: RecipeListProps) {
  const [category, setCategory] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = useMemo(() => {
    return recipes.filter((recipe) => {
      if (!canSeeUnpublished && recipe.status !== 'published') return false
      if (category !== ALL && (recipe.category ?? '') !== category) return false
      return true
    })
  }, [recipes, category, canSeeUnpublished])

  const open = openId ? (recipes.find((r) => r.id === openId) ?? null) : null

  if (open) {
    return <RecipeView recipe={open} onBack={() => setOpenId(null)} />
  }

  return (
    <section className="recipe-list">
      <p className="section-label">
        Receitas
        {communityName ? ` · ${communityName}` : ''}
      </p>

      <div className="recipe-filters" role="tablist" aria-label="Filtrar receitas por categoria">
        {[ALL, ...RECIPE_CATEGORIES].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            className={`recipe-filter${category === key ? ' recipe-filter--active' : ''}`}
            onClick={() => setCategory(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {loading && <p className="recipe-list-status">Carregando receitas...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          message={
            category === ALL
              ? 'Ainda não há receitas por aqui.'
              : `Nenhuma receita em "${category}" por enquanto.`
          }
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="recipe-grid">
          {visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              showStatus={canSeeUnpublished}
              onOpen={() => setOpenId(recipe.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
