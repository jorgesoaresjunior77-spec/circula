import { useState } from 'react'
import type { FormEvent } from 'react'
import { ageFrom } from '../../lib/nutri'
import type { Patient, PatientInput } from '../../lib/nutri'

// Cadastro de paciente: dados pessoais e complementares. Só a nutricionista vê.

const TEXT_FIELDS: { key: keyof PatientInput; label: string; type?: string }[] = [
  { key: 'phone', label: 'Telefone', type: 'tel' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'tel' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'cpf', label: 'CPF (opcional)' },
  { key: 'profession', label: 'Profissão' },
  { key: 'marital_status', label: 'Estado civil (opcional)' },
  { key: 'address', label: 'Endereço (opcional)' },
]

const AREA_FIELDS: { key: keyof PatientInput; label: string }[] = [
  { key: 'main_goal', label: 'Objetivo principal' },
  { key: 'secondary_goals', label: 'Objetivos secundários' },
  { key: 'follow_up_history', label: 'Histórico de acompanhamento' },
  { key: 'food_preferences', label: 'Preferências alimentares' },
  { key: 'food_restrictions', label: 'Restrições alimentares' },
  { key: 'allergies', label: 'Alergias' },
  { key: 'intolerances', label: 'Intolerâncias' },
  { key: 'notes', label: 'Observações gerais' },
]

export function PatientForm({
  patient,
  onSave,
  onCancel,
}: {
  patient: Patient | null
  onSave: (input: PatientInput) => Promise<{ error: string | null }>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<PatientInput>(() =>
    patient ? { ...patient } : { full_name: '', status: 'ativo' },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof PatientInput, value: string) =>
    setDraft((d) => ({ ...d, [key]: value === '' && key !== 'full_name' ? null : value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.full_name.trim()) {
      setError('Escreva o nome completo.')
      return
    }
    setSaving(true)
    setError(null)
    const { id: _id, community_id: _c, created_at: _t, ...rest } = draft as PatientInput & { id?: string; community_id?: string; created_at?: string }
    void _id
    void _c
    void _t
    const r = await onSave(rest)
    setSaving(false)
    if (r.error) setError(r.error)
  }

  const age = ageFrom(draft.birth_date ?? null)

  return (
    <form className="nutri-form" onSubmit={(e) => void submit(e)}>
      <h3>{patient ? 'Editar paciente' : 'Nova paciente'}</h3>
      <label>
        Nome completo
        <input value={draft.full_name} maxLength={160} onChange={(e) => set('full_name', e.target.value)} />
      </label>
      <div className="nutri-row">
        <label>
          Data de nascimento
          <input type="date" value={draft.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value)} />
        </label>
        <label>
          Idade
          <input value={age === null ? '' : `${age} anos`} readOnly aria-label="Idade calculada" />
        </label>
      </div>
      <label>
        Sexo biológico (para cálculos clínicos, quando necessário)
        <select value={draft.sex ?? ''} onChange={(e) => set('sex', e.target.value)}>
          <option value="">Não informado</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
        </select>
      </label>
      {TEXT_FIELDS.map((f) => (
        <label key={f.key}>
          {f.label}
          <input
            type={f.type ?? 'text'}
            value={(draft[f.key] as string | null | undefined) ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}
      {AREA_FIELDS.map((f) => (
        <label key={f.key}>
          {f.label}
          <textarea
            rows={3}
            value={(draft[f.key] as string | null | undefined) ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}
      <label>
        Situação
        <select value={draft.status ?? 'ativo'} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as 'ativo' | 'inativo' }))}>
          <option value="ativo">Ativa</option>
          <option value="inativo">Inativa</option>
        </select>
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
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
