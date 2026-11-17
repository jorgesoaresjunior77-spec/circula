import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Recipe } from '../../hooks/useNutriPlan'
import {
  ACTIVITY_LEVELS,
  dayTotals,
  estimateEnergy,
  macroSplit,
  mealTotals,
  nutrientsFor,
  recipePerPortion,
  uid,
} from '../../lib/nutriPlan'
import type { Food, Plan, PlanItem, PlanMeal } from '../../lib/nutriPlan'
import { FoodPicker } from './FoodPicker'

// Construtor do plano alimentar. A nutricionista define tudo: refeições
// (quantas e com que nome), alimentos, quantidades, medidas caseiras,
// substituições e metas. A estimativa de energia mostra a fórmula e os
// parâmetros, e só vira meta se ela clicar em "Usar como meta".

export type PlanDraft = Omit<Plan, 'id' | 'patient_id' | 'created_at'>

export interface PatientBasics {
  sex: 'F' | 'M' | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
}

const numOrNull = (v: string): number | null => {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || Number.isNaN(n) || n < 0 ? null : n
}

export function emptyPlan(): PlanDraft {
  return {
    name: '',
    objective: null,
    start_date: null,
    review_date: null,
    kcal_target: null,
    protein_g_target: null,
    carb_g_target: null,
    fat_g_target: null,
    fiber_g_target: null,
    water_ml_target: null,
    goals: null,
    energy_estimate: null,
    notes: null,
    guidance: null,
    meals: [
      { id: uid(), name: 'Café da manhã', time: '07:30', notes: '', items: [] },
      { id: uid(), name: 'Almoço', time: '12:30', notes: '', items: [] },
      { id: uid(), name: 'Jantar', time: '19:30', notes: '', items: [] },
    ],
    status: 'rascunho',
    shared_with_patient: false,
  }
}

function newItem(over: Partial<PlanItem>): PlanItem {
  return { id: uid(), kind: 'free', refId: null, name: '', grams: null, household: '', portions: '', prep: '', note: '', nutrients: null, substitutions: [], ...over }
}

export function PlanEditor({
  initial,
  foods,
  recipes,
  basics,
  onSave,
  onCancel,
}: {
  initial: PlanDraft
  foods: Food[]
  recipes: Recipe[]
  basics: PatientBasics
  onSave: (plan: PlanDraft) => Promise<{ error: string | null }>
  onCancel: () => void
}) {
  const [p, setP] = useState<PlanDraft>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [est, setEst] = useState({
    sex: basics.sex ?? 'F',
    age: basics.age ?? 0,
    weight: basics.weightKg ?? 0,
    height: basics.heightCm ?? 0,
    activity: 1.375,
  })

  const set = (patch: Partial<PlanDraft>) => setP((s) => ({ ...s, ...patch }))
  const setMeal = (id: string, patch: Partial<PlanMeal>) => set({ meals: p.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const setItem = (mealId: string, itemId: string, patch: Partial<PlanItem>) =>
    set({
      meals: p.meals.map((m) => (m.id === mealId ? { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : m)),
    })

  /** Recalcula os nutrientes de um item quando muda a quantidade. */
  function regrams(mealId: string, item: PlanItem, grams: number | null) {
    let nutrients = item.nutrients
    if (item.kind === 'food') {
      const f = foods.find((x) => x.id === item.refId)
      nutrients = f && grams ? nutrientsFor(f, grams) : null
    }
    setItem(mealId, item.id, { grams, nutrients })
  }

  function addFood(mealId: string, f: Food) {
    const grams = f.portion_g
    const item = newItem({ kind: 'food', refId: f.id, name: f.name, grams, household: f.portion_label ?? '', nutrients: nutrientsFor(f, grams) })
    setMeal(mealId, { items: [...(p.meals.find((m) => m.id === mealId)?.items ?? []), item] })
  }

  function addRecipe(mealId: string, recipeId: string) {
    const r = recipes.find((x) => x.id === recipeId)
    if (!r) return
    const { perPortion, missing } = recipePerPortion(r.ingredients.map((i) => i.nutrients), r.yield_portions)
    const item = newItem({
      kind: 'recipe',
      refId: r.id,
      name: r.name,
      grams: r.portion_g,
      portions: '1 porção',
      prep: r.preparation ?? '',
      nutrients: missing === r.ingredients.length ? null : perPortion,
    })
    setMeal(mealId, { items: [...(p.meals.find((m) => m.id === mealId)?.items ?? []), item] })
  }

  const day = dayTotals(p.meals)
  const split = macroSplit(day.total)
  const estimate = estimateEnergy({ sex: est.sex, age: est.age, weightKg: est.weight, heightCm: est.height, activityFactor: est.activity })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!p.name.trim()) {
      setError('Dê um nome ao plano.')
      return
    }
    setSaving(true)
    setError(null)
    const r = await onSave({ ...p, name: p.name.trim(), energy_estimate: estimate ?? p.energy_estimate })
    setSaving(false)
    if (r.error) setError(r.error)
  }

  return (
    <form className="nutri-form nutri-plan" onSubmit={(e) => void submit(e)}>
      <h3>Plano alimentar</h3>
      <label>
        Nome do plano
        <input value={p.name} maxLength={160} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label>
        Objetivo nutricional
        <input value={p.objective ?? ''} maxLength={400} onChange={(e) => set({ objective: e.target.value || null })} />
      </label>
      <div className="nutri-grid2">
        <label>
          Início
          <input type="date" value={p.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value || null })} />
        </label>
        <label>
          Validade ou revisão
          <input type="date" value={p.review_date ?? ''} onChange={(e) => set({ review_date: e.target.value || null })} />
        </label>
      </div>

      <h4>Metas nutricionais</h4>
      <div className="nutri-estimate">
        <p className="home-muted">
          Estimativa de necessidade energética (Mifflin-St Jeor). É só uma referência: você decide a meta.
        </p>
        <div className="nutri-grid2">
          <label>
            Sexo
            <select value={est.sex} onChange={(e) => setEst({ ...est, sex: e.target.value as 'F' | 'M' })}>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </label>
          <label>
            Idade (anos)
            <input inputMode="numeric" value={est.age || ''} onChange={(e) => setEst({ ...est, age: Number(e.target.value) || 0 })} />
          </label>
          <label>
            Peso (kg)
            <input inputMode="decimal" value={est.weight || ''} onChange={(e) => setEst({ ...est, weight: Number(e.target.value.replace(',', '.')) || 0 })} />
          </label>
          <label>
            Altura (cm)
            <input inputMode="decimal" value={est.height || ''} onChange={(e) => setEst({ ...est, height: Number(e.target.value.replace(',', '.')) || 0 })} />
          </label>
        </div>
        <label>
          Nível de atividade
          <select value={est.activity} onChange={(e) => setEst({ ...est, activity: Number(e.target.value) })}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.factor} value={a.factor}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {estimate ? (
          <p className="nutri-calc">
            Taxa metabólica basal: <strong>{estimate.bmr} kcal</strong> ({estimate.sex === 'M' ? '10·peso + 6,25·altura − 5·idade + 5' : '10·peso + 6,25·altura − 5·idade − 161'}) × {estimate.activityFactor} ={' '}
            <strong>{estimate.total} kcal/dia</strong>.{' '}
            <button type="button" className="auth-link" onClick={() => set({ kcal_target: estimate.total, energy_estimate: estimate })}>
              Usar como meta
            </button>
          </p>
        ) : (
          <p className="home-muted">Preencha idade, peso e altura para ver a estimativa.</p>
        )}
      </div>
      <div className="nutri-grid2">
        <label>
          Valor energético prescrito (kcal)
          <input inputMode="decimal" value={p.kcal_target ?? ''} onChange={(e) => set({ kcal_target: numOrNull(e.target.value) })} />
        </label>
        <label>
          Proteína (g)
          <input inputMode="decimal" value={p.protein_g_target ?? ''} onChange={(e) => set({ protein_g_target: numOrNull(e.target.value) })} />
        </label>
        <label>
          Carboidratos (g)
          <input inputMode="decimal" value={p.carb_g_target ?? ''} onChange={(e) => set({ carb_g_target: numOrNull(e.target.value) })} />
        </label>
        <label>
          Gorduras (g)
          <input inputMode="decimal" value={p.fat_g_target ?? ''} onChange={(e) => set({ fat_g_target: numOrNull(e.target.value) })} />
        </label>
        <label>
          Fibras (g)
          <input inputMode="decimal" value={p.fiber_g_target ?? ''} onChange={(e) => set({ fiber_g_target: numOrNull(e.target.value) })} />
        </label>
        <label>
          Hidratação (ml)
          <input inputMode="numeric" value={p.water_ml_target ?? ''} onChange={(e) => set({ water_ml_target: numOrNull(e.target.value) })} />
        </label>
      </div>
      <label>
        Metas individuais
        <textarea rows={2} value={p.goals ?? ''} onChange={(e) => set({ goals: e.target.value || null })} />
      </label>

      <h4>Refeições</h4>
      {p.meals.map((m) => {
        const t = mealTotals(m)
        return (
          <section key={m.id} className="nutri-meal">
            <div className="nutri-grid2">
              <label>
                Refeição
                <input value={m.name} maxLength={80} onChange={(e) => setMeal(m.id, { name: e.target.value })} />
              </label>
              <label>
                Horário
                <input type="time" value={m.time} onChange={(e) => setMeal(m.id, { time: e.target.value })} />
              </label>
            </div>
            <ul className="nutri-list">
              {m.items.map((i) => (
                <li key={i.id} className="nutri-item">
                  <div className="nutri-row nutri-row--split">
                    <span>
                      {i.kind === 'free' ? (
                        <input aria-label="Nome do item" value={i.name} placeholder="Item livre" onChange={(e) => setItem(m.id, i.id, { name: e.target.value })} />
                      ) : (
                        <strong>{i.name}</strong>
                      )}
                      <small>{i.nutrients ? `${i.nutrients.kcal} kcal · P ${i.nutrients.protein} · C ${i.nutrients.carb} · G ${i.nutrients.fat}` : 'sem dados nutricionais'}</small>
                    </span>
                    <span className="nutri-actions">
                      <button type="button" className="auth-link" onClick={() => setOpen(open === i.id ? null : i.id)}>
                        {open === i.id ? 'Fechar' : 'Detalhes'}
                      </button>
                      <button type="button" className="auth-link" onClick={() => setMeal(m.id, { items: m.items.filter((x) => x.id !== i.id) })}>
                        Tirar
                      </button>
                    </span>
                  </div>
                  <div className="nutri-grid2">
                    <label>
                      Gramas
                      <input inputMode="decimal" value={i.grams ?? ''} onChange={(e) => regrams(m.id, i, numOrNull(e.target.value))} />
                    </label>
                    <label>
                      Medida caseira
                      <input value={i.household} onChange={(e) => setItem(m.id, i.id, { household: e.target.value })} />
                    </label>
                  </div>
                  {open === i.id && (
                    <div className="nutri-item-more">
                      <label>
                        Porções
                        <input value={i.portions} onChange={(e) => setItem(m.id, i.id, { portions: e.target.value })} />
                      </label>
                      <label>
                        Modo de preparo
                        <textarea rows={2} value={i.prep} onChange={(e) => setItem(m.id, i.id, { prep: e.target.value })} />
                      </label>
                      <label>
                        Observações
                        <textarea rows={2} value={i.note} onChange={(e) => setItem(m.id, i.id, { note: e.target.value })} />
                      </label>
                      <h5>Substituições (definidas por você)</h5>
                      {i.substitutions.map((s) => (
                        <div key={s.id} className="nutri-sub">
                          <input
                            aria-label="Alimento substituto"
                            placeholder="Alimento"
                            value={s.name}
                            onChange={(e) => setItem(m.id, i.id, { substitutions: i.substitutions.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })}
                          />
                          <input
                            aria-label="Gramas do substituto"
                            inputMode="decimal"
                            placeholder="g"
                            value={s.grams ?? ''}
                            onChange={(e) => setItem(m.id, i.id, { substitutions: i.substitutions.map((x) => (x.id === s.id ? { ...x, grams: numOrNull(e.target.value) } : x)) })}
                          />
                          <input
                            aria-label="Medida do substituto"
                            placeholder="Medida caseira"
                            value={s.household}
                            onChange={(e) => setItem(m.id, i.id, { substitutions: i.substitutions.map((x) => (x.id === s.id ? { ...x, household: e.target.value } : x)) })}
                          />
                          <button type="button" className="auth-link" onClick={() => setItem(m.id, i.id, { substitutions: i.substitutions.filter((x) => x.id !== s.id) })}>
                            Tirar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="auth-link"
                        onClick={() => setItem(m.id, i.id, { substitutions: [...i.substitutions, { id: uid(), name: '', grams: null, household: '', note: '' }] })}
                      >
                        + Substituição
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <FoodPicker foods={foods} onPick={(f) => addFood(m.id, f)} />
            <div className="nutri-actions nutri-actions--start">
              {recipes.length > 0 && (
                <select aria-label="Adicionar receita" value="" onChange={(e) => e.target.value && addRecipe(m.id, e.target.value)}>
                  <option value="">+ Receita</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="auth-link" onClick={() => setMeal(m.id, { items: [...m.items, newItem({})] })}>
                + Item livre
              </button>
              <button type="button" className="auth-link" onClick={() => set({ meals: p.meals.filter((x) => x.id !== m.id) })}>
                Excluir refeição
              </button>
            </div>
            <label>
              Observações da refeição
              <textarea rows={2} value={m.notes} onChange={(e) => setMeal(m.id, { notes: e.target.value })} />
            </label>
            <p className="nutri-calc">
              Total da refeição: <strong>{t.total.kcal} kcal</strong> · P {t.total.protein} g · C {t.total.carb} g · G {t.total.fat} g
              {t.missing ? ` · ${t.missing} item(ns) sem dados` : ''}
            </p>
          </section>
        )
      })}
      <button type="button" className="water-primary" onClick={() => set({ meals: [...p.meals, { id: uid(), name: 'Nova refeição', time: '', notes: '', items: [] }] })}>
        Adicionar refeição
      </button>

      <div className="nutri-summary" aria-label="Resumo do dia">
        <h4>Resumo do dia</h4>
        <p className="nutri-calc">
          <strong>{day.total.kcal} kcal</strong>
          {p.kcal_target ? ` de ${p.kcal_target} prescritas` : ''} · P {day.total.protein} g{p.protein_g_target ? ` / ${p.protein_g_target}` : ''} · C {day.total.carb} g
          {p.carb_g_target ? ` / ${p.carb_g_target}` : ''} · G {day.total.fat} g{p.fat_g_target ? ` / ${p.fat_g_target}` : ''} · Fibras {day.total.fiber} g
          {p.fiber_g_target ? ` / ${p.fiber_g_target}` : ''}
          {day.missing ? ` · ${day.missing} item(ns) sem dados nutricionais` : ''}
        </p>
        {split ? (
          <>
            <div className="nutri-macrobar" role="img" aria-label={`Proteínas ${split.protein}%, carboidratos ${split.carb}%, gorduras ${split.fat}%`}>
              <span style={{ width: `${split.protein}%` }} className="nutri-macro nutri-macro--p" />
              <span style={{ width: `${split.carb}%` }} className="nutri-macro nutri-macro--c" />
              <span style={{ width: `${split.fat}%` }} className="nutri-macro nutri-macro--g" />
            </div>
            <p className="home-muted">
              Proteínas {split.protein}% · Carboidratos {split.carb}% · Gorduras {split.fat}%
            </p>
          </>
        ) : (
          <p className="home-muted">Adicione alimentos com dados nutricionais para ver a distribuição.</p>
        )}
      </div>

      <label>
        Orientações gerais (a paciente poderá ver, se você compartilhar)
        <textarea rows={4} value={p.guidance ?? ''} onChange={(e) => set({ guidance: e.target.value || null })} />
      </label>
      <label>
        Observações internas (só você vê)
        <textarea rows={3} value={p.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} />
      </label>
      <label className="nutri-check">
        <input type="checkbox" checked={p.shared_with_patient} onChange={(e) => set({ shared_with_patient: e.target.checked })} />
        Disponível para a paciente (a área dela chega na próxima etapa)
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="nutri-actions">
        <button type="button" className="auth-link" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="water-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar plano'}
        </button>
      </div>
    </form>
  )
}
