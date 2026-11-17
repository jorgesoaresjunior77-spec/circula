import { useState } from 'react'
import { usePatientPlans } from '../../hooks/useNutriPlan'
import type { Recipe } from '../../hooks/useNutriPlan'
import { brDate } from '../../lib/nutri'
import { dayTotals, uid } from '../../lib/nutriPlan'
import type { Food, Plan } from '../../lib/nutriPlan'
import { planHtml, printDocument } from '../../lib/nutriPrint'
import { PlanEditor, emptyPlan } from './PlanEditor'
import type { PatientBasics, PlanDraft } from './PlanEditor'

// Planejamento alimentar do paciente: cada versão é um plano. Salvar uma
// edição de plano ativo mantém a versão; "Nova versão" copia o plano para
// começar outro sem perder o anterior.

const STATUS: Record<Plan['status'], string> = { rascunho: 'Rascunho', ativo: 'Ativo', arquivado: 'Arquivado' }

function toDraft(p: Plan, asNew: boolean): PlanDraft {
  const { id: _id, patient_id: _pid, created_at: _ca, ...rest } = p
  void _id
  void _pid
  void _ca
  return {
    ...rest,
    name: asNew ? `${p.name} (nova versão)` : p.name,
    status: asNew ? 'rascunho' : p.status,
    shared_with_patient: asNew ? false : p.shared_with_patient,
    meals: p.meals.map((m) => ({
      ...m,
      id: asNew ? uid() : m.id,
      items: m.items.map((i) => ({ ...i, id: asNew ? uid() : i.id, substitutions: i.substitutions.map((s) => ({ ...s, id: asNew ? uid() : s.id })) })),
    })),
  }
}

export function PlanTab({
  patientId,
  communityId,
  foods,
  recipes,
  basics,
  patientName,
  nutriName,
}: {
  patientId: string
  communityId: string
  foods: Food[]
  recipes: Recipe[]
  basics: PatientBasics
  patientName: string
  nutriName: string
}) {
  const { plans, loading, savePlan, setStatus } = usePatientPlans(patientId, communityId)
  const [editing, setEditing] = useState<{ id: string | null; draft: PlanDraft } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="home-muted">Carregando planos…</p>

  if (editing) {
    return (
      <PlanEditor
        initial={editing.draft}
        foods={foods}
        recipes={recipes}
        basics={basics}
        onCancel={() => setEditing(null)}
        onSave={async (draft) => {
          const r = await savePlan(editing.id, draft)
          if (!r.error) setEditing(null)
          return r
        }}
      />
    )
  }

  async function activate(plan: Plan) {
    setError(null)
    for (const other of plans.filter((x) => x.status === 'ativo' && x.id !== plan.id)) {
      await setStatus(other.id, 'arquivado')
    }
    const r = await setStatus(plan.id, 'ativo')
    if (r.error) setError(r.error)
  }

  return (
    <div className="nutri-plans">
      <button type="button" className="water-primary" onClick={() => setEditing({ id: null, draft: emptyPlan() })}>
        Criar plano alimentar
      </button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {plans.length === 0 && <p className="home-muted">Nenhum plano criado para esta paciente.</p>}
      <ul className="nutri-timeline">
        {plans.map((pl) => {
          const t = dayTotals(pl.meals).total
          return (
            <li key={pl.id} className="nutri-timeline-item">
              <div className="nutri-timeline-head">
                <strong>{pl.name}</strong>
                <span className={`nutri-chip nutri-chip--${pl.status}`}>{STATUS[pl.status]}</span>
              </div>
              <p className="home-muted">
                Criado em {brDate(pl.created_at)}
                {pl.start_date ? ` · início ${brDate(pl.start_date)}` : ''}
                {pl.review_date ? ` · revisão ${brDate(pl.review_date)}` : ''}
              </p>
              <p className="nutri-calc">
                {pl.meals.length} refeições · {t.kcal} kcal · P {t.protein} g · C {t.carb} g · G {t.fat} g
              </p>
              <div className="nutri-actions nutri-actions--start">
                <button type="button" className="auth-link" onClick={() => setEditing({ id: pl.id, draft: toDraft(pl, false) })}>
                  Editar
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    if (!printDocument(planHtml(pl, patientName, nutriName))) setError('O navegador bloqueou a janela do PDF. Permita pop-ups e tente de novo.')
                  }}
                >
                  Gerar PDF
                </button>
                <button type="button" className="auth-link" onClick={() => setEditing({ id: null, draft: toDraft(pl, true) })}>
                  Nova versão
                </button>
                {pl.status !== 'ativo' && (
                  <button type="button" className="auth-link" onClick={() => void activate(pl)}>
                    Ativar
                  </button>
                )}
                {pl.status !== 'arquivado' && (
                  <button type="button" className="auth-link" onClick={() => void setStatus(pl.id, 'arquivado')}>
                    Arquivar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
