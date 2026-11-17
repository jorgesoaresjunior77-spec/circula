import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Recipe, RecipeIngredient } from '../../hooks/useNutriPlan'
import { nutrientsFor, recipePerPortion, uid } from '../../lib/nutriPlan'
import type { Food } from '../../lib/nutriPlan'
import { FoodPicker } from './FoodPicker'

// Receitas da nutricionista: ingredientes do banco de alimentos, rendimento,
// porção individual e modo de preparo. A composição por porção é a soma dos
// ingredientes dividida pelo rendimento; ingrediente sem calorias no banco
// fica de fora da conta e o aviso aparece.

type Draft = Omit<Recipe, 'id'> & { id: string | null }

const EMPTY: Draft = { id: null, name: '', yield_portions: 1, portion_g: null, ingredients: [], preparation: '' }

export function RecipesManager({
  recipes,
  foods,
  onSave,
  onRemove,
  onBack,
}: {
  recipes: Recipe[]
  foods: Food[]
  onSave: (id: string | null, r: Omit<Recipe, 'id'>) => Promise<{ error: string | null }>
  onRemove: (id: string) => Promise<{ error: string | null }>
  onBack: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (draft) {
    const { perPortion, missing } = recipePerPortion(
      draft.ingredients.map((i) => i.nutrients),
      draft.yield_portions,
    )
    const setIng = (id: string, grams: number) =>
      setDraft({
        ...draft,
        ingredients: draft.ingredients.map((i) => {
          if (i.id !== id) return i
          const food = foods.find((f) => f.id === i.foodId)
          return { ...i, grams, nutrients: food ? nutrientsFor(food, grams) : null }
        }),
      })
    const add = (f: Food) => {
      const grams = f.portion_g
      const ing: RecipeIngredient = { id: uid(), foodId: f.id, name: f.name, grams, nutrients: nutrientsFor(f, grams) }
      setDraft({ ...draft, ingredients: [...draft.ingredients, ing] })
    }

    async function submit(e: FormEvent) {
      e.preventDefault()
      if (!draft?.name.trim()) {
        setError('Dê um nome à receita.')
        return
      }
      const { id, ...rest } = draft
      const r = await onSave(id, rest)
      if (r.error) setError(r.error)
      else {
        setDraft(null)
        setError(null)
      }
    }

    return (
      <form className="nutri-form" onSubmit={(e) => void submit(e)}>
        <h3>{draft.id ? 'Editar receita' : 'Nova receita'}</h3>
        <label>
          Nome
          <input value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="nutri-grid2">
          <label>
            Rendimento (porções)
            <input
              inputMode="decimal"
              value={draft.yield_portions}
              onChange={(e) => setDraft({ ...draft, yield_portions: Math.max(0.5, Number(e.target.value.replace(',', '.')) || 1) })}
            />
          </label>
          <label>
            Porção individual (g, opcional)
            <input
              inputMode="decimal"
              value={draft.portion_g ?? ''}
              onChange={(e) => setDraft({ ...draft, portion_g: Number(e.target.value.replace(',', '.')) || null })}
            />
          </label>
        </div>
        <h4>Ingredientes</h4>
        <FoodPicker foods={foods} onPick={add} placeholder="Buscar ingrediente no banco de alimentos" />
        {draft.ingredients.length === 0 && <p className="home-muted">Adicione os ingredientes.</p>}
        <ul className="nutri-list">
          {draft.ingredients.map((i) => (
            <li key={i.id} className="nutri-row nutri-row--split">
              <span>
                <strong>{i.name}</strong>
                <small>{i.nutrients ? `${i.nutrients.kcal} kcal` : 'sem calorias no banco'}</small>
              </span>
              <span className="nutri-actions">
                <input
                  className="nutri-qty"
                  inputMode="decimal"
                  aria-label={`Gramas de ${i.name}`}
                  value={i.grams}
                  onChange={(e) => setIng(i.id, Number(e.target.value.replace(',', '.')) || 0)}
                />
                g
                <button type="button" className="auth-link" onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((x) => x.id !== i.id) })}>
                  Tirar
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="nutri-calc">
          Por porção: <strong>{perPortion.kcal} kcal</strong> · P {perPortion.protein} g · C {perPortion.carb} g · G {perPortion.fat} g · Fibras {perPortion.fiber} g
          {missing > 0 ? ` (${missing} ingrediente(s) sem dados nutricionais ficaram fora da conta)` : ''}
        </p>
        <label>
          Modo de preparo
          <textarea rows={5} value={draft.preparation ?? ''} onChange={(e) => setDraft({ ...draft, preparation: e.target.value })} />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="nutri-actions">
          <button type="button" className="auth-link" onClick={() => setDraft(null)}>
            Cancelar
          </button>
          <button type="submit" className="water-primary">
            Salvar receita
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="nutri-module">
      <button type="button" className="auth-link" onClick={onBack}>
        ‹ Gestão Nutricional
      </button>
      <h2>Receitas</h2>
      <p className="home-muted">Receitas com composição nutricional, para usar nas refeições dos planos.</p>
      <button type="button" className="water-primary" onClick={() => setDraft({ ...EMPTY })}>
        Nova receita
      </button>
      {recipes.length === 0 && <p className="home-muted">Nenhuma receita cadastrada.</p>}
      <ul className="nutri-list">
        {recipes.map((r) => {
          const { perPortion } = recipePerPortion(r.ingredients.map((i) => i.nutrients), r.yield_portions)
          return (
            <li key={r.id} className="nutri-row nutri-row--split">
              <span>
                <strong>{r.name}</strong>
                <small>
                  {perPortion.kcal} kcal por porção · rende {r.yield_portions}
                </small>
              </span>
              <span className="nutri-actions">
                <button type="button" className="auth-link" onClick={() => setDraft({ ...r })}>
                  Editar
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    if (window.confirm(`Excluir "${r.name}"? Planos já feitos não mudam.`)) void onRemove(r.id)
                  }}
                >
                  Excluir
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
