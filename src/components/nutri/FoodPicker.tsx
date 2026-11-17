import { useMemo, useState } from 'react'
import type { Food } from '../../lib/nutriPlan'

// Busca no banco de alimentos: digita, escolhe na lista. Mostra só os 12
// primeiros resultados para a tela não pesar com bancos grandes.

export function FoodPicker({ foods, onPick, placeholder = 'Buscar alimento' }: { foods: Food[]; onPick: (f: Food) => void; placeholder?: string }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return foods.filter((f) => f.name.toLowerCase().includes(t)).slice(0, 12)
  }, [foods, q])

  return (
    <div className="nutri-picker">
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && results.length === 0 && (
        <p className="home-muted">
          Nenhum alimento encontrado. Cadastre em Banco de alimentos ou use "Item livre".
        </p>
      )}
      {results.length > 0 && (
        <ul className="nutri-picker-list">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(f)
                  setQ('')
                }}
              >
                <strong>{f.name}</strong>
                <span>
                  {f.kcal != null ? `${f.kcal} kcal` : 'sem calorias'} / {f.portion_g} g
                  {f.category ? ` · ${f.category}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
