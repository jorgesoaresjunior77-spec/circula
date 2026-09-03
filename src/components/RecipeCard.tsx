import type { CommunityContent } from '../types/content'
import { RecipeIcon } from './icons'

// Fase 2 — card de receita na visão da usuária.
// Mostra só o essencial: FOTO grande, TÍTULO claro e CATEGORIA.
// O card inteiro é o alvo de toque (grande, confortável no celular).

interface RecipeCardProps {
  recipe: CommunityContent
  onOpen: () => void
  /** Selo discreto quando não está publicada (só a anfitriã vê rascunho). */
  showStatus?: boolean
}

export function RecipeCard({ recipe, onOpen, showStatus = false }: RecipeCardProps) {
  return (
    <button type="button" className="recipe-card" onClick={onOpen}>
      <span className="recipe-card-cover" aria-hidden="true">
        {recipe.cover_image_url ? (
          <img src={recipe.cover_image_url} alt="" />
        ) : (
          <span className="recipe-card-cover-fallback">
            <RecipeIcon size={40} />
          </span>
        )}
      </span>

      <span className="recipe-card-body">
        {recipe.category && <span className="recipe-card-category">{recipe.category}</span>}
        <span className="recipe-card-title">{recipe.title}</span>
        {showStatus && recipe.status !== 'published' && (
          <span className="recipe-card-flag">
            {recipe.status === 'draft' ? 'Rascunho' : 'Arquivada'}
          </span>
        )}
      </span>
    </button>
  )
}
