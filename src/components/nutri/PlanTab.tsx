import { useState } from 'react'
import { usePatientPlans } from '../../hooks/useNutriPlan'
import type { Recipe } from '../../hooks/useNutriPlan'
import { brDate } from '../../lib/nutri'
import { dayTotals, uid } from '../../lib/nutriPlan'
import type { Food, Plan } from '../../lib/nutriPlan'
import { planHtml, printDocument, shoppingHtml } from '../../lib/nutriPrint'
import { createListFromPlan } from '../../hooks/useShopping'
import { shoppingList } from '../../lib/nutriPlan'
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
  otherPatients,
  linkedProfileId,
}: {
  patientId: string
  communityId: string
  foods: Food[]
  recipes: Recipe[]
  basics: PatientBasics
  patientName: string
  nutriName: string
  otherPatients: { id: string; full_name: string }[]
  /** Participante vinculada à paciente (recebe a lista de compras, se houver). */
  linkedProfileId: string | null
}) {
  const { plans, loading, savePlan, setStatus, copyTo } = usePatientPlans(patientId, communityId)
  const [shopDays, setShopDays] = useState(7)
  const [copying, setCopying] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
      {notice && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
      <label className="nutri-inline">
        Dias da lista de compras
        <input inputMode="numeric" value={shopDays} onChange={(e) => setShopDays(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
      </label>
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
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    if (!printDocument(shoppingHtml(pl, shopDays, patientName, nutriName))) setError('O navegador bloqueou a janela do PDF. Permita pop-ups e tente de novo.')
                  }}
                >
                  Lista de compras
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={async () => {
                    setError(null)
                    const lines = shoppingList(pl.meals, shopDays).map((l) => ({ name: l.name, grams: l.grams }))
                    const r = await createListFromPlan({
                      communityId,
                      name: `Compras: ${patientName.split(' ')[0]} · ${pl.name}`,
                      notes: `Lista para ${shopDays} dia(s), a partir do plano "${pl.name}".`,
                      lines,
                      shareWith: linkedProfileId,
                    })
                    if (r.error) setError(r.error)
                    else
                      setNotice(
                        linkedProfileId
                          ? 'Lista criada na sua Minha Lista e compartilhada com a paciente.'
                          : 'Lista criada na sua Minha Lista. Para compartilhar com a paciente, vincule-a a uma participante no cadastro.',
                      )
                  }}
                >
                  Lista de compras na Minha Lista
                </button>
                {otherPatients.length > 0 && (
                  <button type="button" className="auth-link" onClick={() => setCopying(copying === pl.id ? null : pl.id)}>
                    Copiar para outra paciente
                  </button>
                )}
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
              {copying === pl.id && (
                <select
                  aria-label="Copiar para a paciente"
                  value=""
                  onChange={async (e) => {
                    const target = otherPatients.find((x) => x.id === e.target.value)
                    if (!target) return
                    const r = await copyTo(pl, target.id)
                    setCopying(null)
                    if (r.error) setError(r.error)
                    else setNotice(`Plano copiado para ${target.full_name} como rascunho.`)
                  }}
                >
                  <option value="">Escolha a paciente…</option>
                  {otherPatients.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name}
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
