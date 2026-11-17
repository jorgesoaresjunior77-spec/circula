import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brDate } from '../lib/nutri'
import { dayTotals } from '../lib/nutriPlan'
import type { Plan } from '../lib/nutriPlan'

// Meu plano alimentar (área da paciente, dentro do perfil). Mostra só o que a
// nutricionista compartilhou, vindo da função get_my_nutri_plan: nunca as
// observações internas, a anamnese nem os exames. Quem não é paciente
// vinculada não vê nada aqui.

interface Shared {
  patient_name: string
  plan: Pick<
    Plan,
    | 'name'
    | 'objective'
    | 'start_date'
    | 'review_date'
    | 'kcal_target'
    | 'protein_g_target'
    | 'carb_g_target'
    | 'fat_g_target'
    | 'fiber_g_target'
    | 'water_ml_target'
    | 'goals'
    | 'guidance'
    | 'meals'
  > | null
  next_consultation: string | null
  evolution: { assessed_on: string; weight_kg: number | null; waist_cm: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null }[]
}

const fmt = (n: number | null | undefined, d = 1): string => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: d }))

export function MyNutriPlan() {
  const [data, setData] = useState<Shared | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('get_my_nutri_plan').then(({ data: d, error }) => {
      if (cancelled) return
      setData(error ? null : ((d as Shared | null) ?? null))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null
  const { plan } = data
  const totals = plan ? dayTotals(plan.meals).total : null
  const meals = plan ? [...plan.meals].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) : []

  return (
    <section className="my-nutri" aria-label="Meu plano alimentar">
      <p className="profile-section-label">Meu plano alimentar</p>
      {data.next_consultation && <p className="nutri-calc">Próxima consulta: <strong>{brDate(data.next_consultation)}</strong></p>}

      {!plan && <p className="home-muted">Sua nutricionista ainda não compartilhou um plano alimentar.</p>}

      {plan && (
        <>
          <h3>{plan.name}</h3>
          <p className="home-muted">
            {plan.objective ? `${plan.objective} · ` : ''}
            {plan.start_date ? `desde ${brDate(plan.start_date)}` : ''}
            {plan.review_date ? ` · revisão ${brDate(plan.review_date)}` : ''}
          </p>
          {(plan.kcal_target || plan.water_ml_target || plan.goals) && (
            <div className="nutri-fact">
              <dt>Metas</dt>
              <dd>
                {[
                  plan.kcal_target ? `${fmt(plan.kcal_target, 0)} kcal` : null,
                  plan.protein_g_target ? `proteínas ${fmt(plan.protein_g_target, 0)} g` : null,
                  plan.carb_g_target ? `carboidratos ${fmt(plan.carb_g_target, 0)} g` : null,
                  plan.fat_g_target ? `gorduras ${fmt(plan.fat_g_target, 0)} g` : null,
                  plan.fiber_g_target ? `fibras ${fmt(plan.fiber_g_target, 0)} g` : null,
                  plan.water_ml_target ? `água ${fmt(plan.water_ml_target, 0)} ml` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {plan.goals ? <><br />{plan.goals}</> : null}
              </dd>
            </div>
          )}
          {meals.map((m) => (
            <article key={m.id} className="nutri-timeline-item">
              <div className="nutri-timeline-head">
                <strong>
                  {m.time ? `${m.time} · ` : ''}
                  {m.name}
                </strong>
              </div>
              <ul className="my-nutri-items">
                {m.items.map((i) => {
                  const subs = i.substitutions.filter((s) => s.name.trim())
                  return (
                    <li key={i.id}>
                      <strong>{i.name}</strong>{' '}
                      <span className="home-muted">{[i.grams ? `${fmt(i.grams, 0)} g` : '', i.household, i.portions].filter(Boolean).join(' · ')}</span>
                      {i.prep && <div className="home-muted">{i.prep}</div>}
                      {i.note && <div className="home-muted">{i.note}</div>}
                      {subs.length > 0 && (
                        <div className="home-muted">
                          Pode trocar por: {subs.map((s) => [s.name, s.grams ? `${fmt(s.grams, 0)} g` : '', s.household].filter(Boolean).join(' · ')).join('; ')}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {m.notes && <p className="nutri-notes">{m.notes}</p>}
            </article>
          ))}
          {totals && totals.kcal > 0 && <p className="home-muted">Total aproximado do dia: {fmt(totals.kcal, 0)} kcal.</p>}
          {plan.guidance && (
            <>
              <h4>Orientações</h4>
              <p className="nutri-notes">{plan.guidance}</p>
            </>
          )}
        </>
      )}

      {data.evolution.length > 0 && (
        <>
          <h4>Minha evolução</h4>
          <table className="nutri-compare">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso (kg)</th>
                <th>Cintura (cm)</th>
                <th>Gordura (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.evolution.map((e) => (
                <tr key={e.assessed_on}>
                  <td>{brDate(e.assessed_on)}</td>
                  <td>{fmt(e.weight_kg)}</td>
                  <td>{fmt(e.waist_cm)}</td>
                  <td>{fmt(e.body_fat_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
