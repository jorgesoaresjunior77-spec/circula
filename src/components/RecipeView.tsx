import type { CommunityContent } from '../types/content'
import { ChevronLeftIcon, RecipeIcon } from './icons'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'

// Fase 2 — visualização completa de uma receita.
// Prioridade absoluta: LEGIBILIDADE. Foto maior no topo, título grande,
// descrição, ingredientes em lista espaçada e, quando houver, modo de
// preparo. Botão "Voltar" grande e fácil de achar.

interface RecipeViewProps {
  recipe: CommunityContent
  onBack: () => void
}

function toLines(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s?/, '').trim())
    .filter((line) => line.length > 0)
}

export function RecipeView({ recipe, onBack }: RecipeViewProps) {
  const ingredients = toLines(recipe.ingredients)
  const author = recipe.author?.full_name ?? 'Equipe da comunidade'
  const { url: coverUrl } = useSignedImageUrl(recipe.cover_image_url)

  return (
    <article className="recipe-view">
      <button type="button" className="recipe-view-back" onClick={onBack}>
        <ChevronLeftIcon size={20} />
        <span>Voltar para as receitas</span>
      </button>

      <div className="recipe-view-cover" aria-hidden="true">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span className="recipe-view-cover-fallback">
            <RecipeIcon size={56} />
          </span>
        )}
      </div>

      <div className="recipe-view-head">
        {recipe.category && (
          <span className="recipe-view-category">{recipe.category}</span>
        )}
        <h2 className="recipe-view-title">{recipe.title}</h2>
        <p className="recipe-view-meta">
          Por {author} · {formatRelativeTime(recipe.created_at)}
        </p>
      </div>

      {recipe.summary && <p className="recipe-view-summary">{recipe.summary}</p>}

      {ingredients.length > 0 && (
        <section className="recipe-view-section">
          <h3 className="recipe-view-section-title">Ingredientes</h3>
          <ul className="recipe-view-ingredients">
            {ingredients.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.body && (
        <section className="recipe-view-section">
          <h3 className="recipe-view-section-title">Modo de preparo</h3>
          <div className="recipe-view-steps">{recipe.body}</div>
        </section>
      )}
    </article>
  )
}
