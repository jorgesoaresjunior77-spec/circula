import { useMemo, useState } from 'react'
import { usePatientRecord } from '../../hooks/useNutri'
import { ageFrom, bmi, brDate, heightAt, sortAssessments, needsReturn, isoToday } from '../../lib/nutri'
import type { Patient, PatientInput } from '../../lib/nutri'
import { AnamnesisForm } from './AnamnesisForm'
import { AssessmentsTab } from './AssessmentsTab'
import { ConsultationsTab } from './ConsultationsTab'
import { PatientForm } from './PatientForm'
import { PlanTab } from './PlanTab'
import { PrivacyTab } from './PrivacyTab'
import { FollowUpTab } from './FollowUpTab'
import { BillingTab } from './BillingTab'
import { erasePatient } from '../../hooks/useNutriLgpd'
import { PatientPhoto } from './PatientPhoto'
import { DocumentsTab, ExamsTab } from './FilesTabs'
import { assessmentHtml, evolutionHtml, printDocument } from '../../lib/nutriPrint'
import type { Recipe } from '../../hooks/useNutriPlan'
import type { Food } from '../../lib/nutriPlan'

// Prontuário digital do paciente, em abas. As abas de plano alimentar,
// exames, receitas e documentos chegam nas próximas etapas e aparecem
// marcadas como "em breve" para o caminho ficar visível.

export type Tab = 'resumo' | 'dados' | 'anamnese' | 'avaliacao' | 'plano' | 'exames' | 'documentos' | 'privacidade' | 'consultas' | 'acompanhamento' | 'assinatura' | 'obs' | 'historico'

const TABS: { key: Tab; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'dados', label: 'Dados pessoais' },
  { key: 'anamnese', label: 'Anamnese' },
  { key: 'avaliacao', label: 'Avaliação e medidas' },
  { key: 'plano', label: 'Planejamento alimentar' },
  { key: 'exames', label: 'Exames' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'privacidade', label: 'Privacidade (LGPD)' },
  { key: 'consultas', label: 'Consultas e evolução' },
  { key: 'acompanhamento', label: 'Acompanhamento da paciente' },
  { key: 'assinatura', label: 'Assinatura e pagamentos' },
  { key: 'obs', label: 'Observações' },
  { key: 'historico', label: 'Histórico de alterações' },
]

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="nutri-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function PatientRecord({
  patient,
  communityId,
  onSavePatient,
  onBack,
  onChanged,
  initialTab = 'resumo',
  initialEditing = false,
  foods,
  recipes,
  nutriName,
  members,
  otherPatients,
}: {
  patient: Patient
  communityId: string
  onSavePatient: (input: PatientInput) => Promise<{ error: string | null }>
  onBack: () => void
  onChanged: () => void
  initialTab?: Tab
  initialEditing?: boolean
  foods: Food[]
  recipes: Recipe[]
  nutriName: string
  members: { id: string; full_name: string | null }[]
  otherPatients: { id: string; full_name: string }[]
}) {
  const rec = usePatientRecord(patient.id, communityId)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [editing, setEditing] = useState(initialEditing)

  const sorted = useMemo(() => sortAssessments(rec.assessments), [rec.assessments])
  const last = sorted.at(-1) ?? null
  const lastHeight = sorted.length ? heightAt(sorted, sorted.length - 1) : null
  const age = ageFrom(patient.birth_date)
  const today = isoToday()
  const nextConsult = rec.consultations.filter((c) => c.status === 'agendada' && c.scheduled_on >= today).map((c) => c.scheduled_on).sort()[0]
  const returnDue = needsReturn(rec.consultations, today)

  return (
    <section className="nutri-record">
      <button type="button" className="auth-link" onClick={onBack}>
        ‹ Pacientes
      </button>
      <header className="nutri-record-head">
        <PatientPhoto patient={patient} communityId={communityId} onChanged={onChanged} />
        <h2>{patient.full_name}</h2>
        <div className="nutri-head-actions">
          <button type="button" className="hw-ghost" onClick={() => { setTab('dados'); setEditing(true) }}>
            Editar paciente
          </button>
          <button
            type="button"
            className="hw-ghost nutri-danger"
            onClick={async () => {
              if (!window.confirm(`Excluir ${patient.full_name}? Todos os dados e arquivos dela serão apagados e não dá para desfazer.`)) return
              const r = await erasePatient(patient.id)
              if (r.error) return window.alert(r.error)
              onChanged()
              onBack()
            }}
          >
            Excluir paciente
          </button>
        </div>
        <p className="home-muted">
          {age !== null ? `${age} anos` : 'Idade não informada'} · {patient.status === 'ativo' ? 'Ativa' : 'Inativa'}
          {returnDue ? ' · precisa de retorno' : ''}
          {patient.consent_at ? '' : ' · sem consentimento registrado'}
        </p>
      </header>

      <div className="nutri-tabs" role="tablist" aria-label="Prontuário">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`nutri-tab${tab === t.key ? ' nutri-tab--on' : ''}`}
            onClick={() => {
              setTab(t.key)
              setEditing(false)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rec.loading ? (
        <p className="home-muted">Carregando prontuário…</p>
      ) : (
        <div className="nutri-panel" role="tabpanel">
          {tab === 'resumo' && (
            <>
              <dl className="nutri-facts-grid">
                <Fact label="Objetivo principal" value={patient.main_goal} />
                <Fact label="Última avaliação" value={last ? brDate(last.assessed_on) : 'Nenhuma'} />
                <Fact label="Peso atual" value={last?.weight_kg != null ? `${last.weight_kg} kg` : null} />
                <Fact label="IMC" value={bmi(last?.weight_kg, lastHeight)} />
                <Fact label="Próxima consulta" value={nextConsult ? brDate(nextConsult) : 'Não agendada'} />
                <Fact label="Alergias" value={patient.allergies} />
                <Fact label="Restrições alimentares" value={patient.food_restrictions} />
                <Fact label="Intolerâncias" value={patient.intolerances} />
                <Fact label="Anamnese" value={rec.anamnesis ? (rec.anamnesis.status === 'concluida' ? 'Concluída' : 'Rascunho') : 'Não iniciada'} />
              </dl>
              <div className="nutri-actions">
                <button type="button" className="water-primary" onClick={() => setTab('avaliacao')}>
                  Nova avaliação
                </button>
                <button type="button" className="water-primary" onClick={() => setTab('consultas')}>
                  Registrar evolução
                </button>
              </div>
            </>
          )}

          {tab === 'dados' &&
            (editing ? (
              <PatientForm
                patient={patient}
                members={members}
                communityId={communityId}
                onSave={async (input) => {
                  const r = await onSavePatient(input)
                  if (!r.error) {
                    setEditing(false)
                    onChanged()
                  }
                  return r
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <dl className="nutri-facts-grid">
                  <Fact label="Nascimento" value={brDate(patient.birth_date)} />
                  <Fact label="Idade" value={age !== null ? `${age} anos` : null} />
                  <Fact label="Sexo biológico" value={patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : null} />
                  <Fact label="Telefone" value={patient.phone} />
                  <Fact label="WhatsApp" value={patient.whatsapp} />
                  <Fact label="E-mail" value={patient.email} />
                  <Fact label="CPF" value={patient.cpf} />
                  <Fact label="Profissão" value={patient.profession} />
                  <Fact label="Estado civil" value={patient.marital_status} />
                  <Fact label="Endereço" value={patient.address} />
                  <Fact label="Objetivos secundários" value={patient.secondary_goals} />
                  <Fact label="Histórico de acompanhamento" value={patient.follow_up_history} />
                  <Fact label="Preferências alimentares" value={patient.food_preferences} />
                  <Fact label="Cadastro" value={brDate(patient.created_at)} />
                </dl>
                <button type="button" className="water-primary" onClick={() => setEditing(true)}>
                  Editar dados
                </button>
              </>
            ))}

          {tab === 'anamnese' && (
            <AnamnesisForm
              initial={rec.anamnesis?.data ?? {}}
              status={rec.anamnesis?.status ?? null}
              updatedAt={rec.anamnesis?.updated_at ?? null}
              onSave={rec.saveAnamnesis}
            />
          )}

          {tab === 'avaliacao' && (
            <AssessmentsTab
              assessments={rec.assessments}
              sex={patient.sex}
              onAdd={rec.addAssessment}
              onRemove={rec.removeAssessment}
              onPdf={(a) => printDocument(assessmentHtml(a, rec.assessments, patient.full_name, nutriName))}
              onEvolutionPdf={() => printDocument(evolutionHtml(rec.assessments, rec.consultations, patient.full_name, nutriName))}
            />
          )}

          {tab === 'plano' && (
            <PlanTab
              patientId={patient.id}
              communityId={communityId}
              foods={foods}
              recipes={recipes}
              basics={{ sex: patient.sex, age, weightKg: last?.weight_kg ?? null, heightCm: lastHeight }}
              patientName={patient.full_name}
              nutriName={nutriName}
              otherPatients={otherPatients}
              linkedProfileId={patient.linked_profile_id ?? null}
            />
          )}

          {tab === 'exames' && <ExamsTab patientId={patient.id} communityId={communityId} />}

          {tab === 'documentos' && <DocumentsTab patientId={patient.id} communityId={communityId} />}

          {tab === 'privacidade' && <PrivacyTab patient={patient} nutriName={nutriName} onChanged={onChanged} onErased={onBack} />}

          {tab === 'consultas' && (
            <ConsultationsTab consultations={rec.consultations} onAdd={rec.addConsultation} onSetStatus={rec.setConsultationStatus} />
          )}

          {tab === 'assinatura' && <BillingTab patientId={patient.id} />}

          {tab === 'acompanhamento' && <FollowUpTab patientId={patient.id} communityId={communityId} linkedProfileId={patient.linked_profile_id ?? null} patientName={patient.full_name} whatsapp={patient.whatsapp ?? patient.phone ?? null} />}

          {tab === 'obs' && (
            <>
              <p className="home-muted">Observações internas: só você vê.</p>
              <p className="nutri-notes">{patient.notes || 'Sem observações.'}</p>
              <button type="button" className="water-primary" onClick={() => { setTab('dados'); setEditing(true) }}>
                Editar observações
              </button>
            </>
          )}

          {tab === 'historico' && (
            <ul className="nutri-timeline">
              {rec.history.length === 0 && <li className="home-muted">Sem registros.</li>}
              {rec.history.map((h) => (
                <li key={h.id} className="nutri-timeline-item">
                  <strong>
                    {h.section} · {h.action}
                  </strong>
                  <p className="home-muted">
                    {new Date(h.at).toLocaleString('pt-BR')}
                    {h.summary ? ` — ${h.summary}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
