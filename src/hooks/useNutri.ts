import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Assessment, AssessmentInput, Consultation, Patient, PatientInput } from '../lib/nutri'
import type { AnamnesisData } from '../lib/nutriAnamnesis'

// Gestão Nutricional: leitura e gravação dos dados da nutricionista. Tudo
// passa pela RLS (só a dona da comunidade). Cada gravação importante deixa
// uma linha em nutri_record_log (quem, quando, o quê).

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente novamente.'

const PATIENT_COLS =
  'id,community_id,full_name,photo_path,birth_date,sex,phone,whatsapp,email,cpf,profession,marital_status,address,notes,linked_profile_id,consent_at,consent_note,main_goal,secondary_goals,follow_up_history,food_preferences,food_restrictions,allergies,intolerances,status,created_at'
const CONSULT_COLS = 'id,patient_id,kind,status,scheduled_on,scheduled_time,evolution,next_return_on'
const ASSESS_COLS =
  'id,patient_id,assessed_on,weight_kg,height_cm,abdomen_cm,waist_cm,hip_cm,arm_cm,thigh_cm,calf_cm,body_fat_pct,muscle_mass_kg,fat_mass_kg,body_water_pct,bone_mass_kg,skinfolds,custom,source,notes,shared_with_patient'

async function log(communityId: string, patientId: string, section: string, action: 'criou' | 'editou' | 'excluiu', summary: string) {
  await supabase
    .from('nutri_record_log')
    .insert({ community_id: communityId, patient_id: patientId, section, action, summary: summary.slice(0, 300) })
}

/** Visão geral da nutricionista: pacientes, consultas e quem já tem avaliação. */
export function useNutriOverview(communityId: string | null) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [assessedIds, setAssessedIds] = useState<Set<string>>(new Set())
  const [activePlans, setActivePlans] = useState(0)
  const [loading, setLoading] = useState(!!communityId)
  const [failed, setFailed] = useState(false)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const [p, c, a, pl] = await Promise.all([
        supabase.from('nutri_patients').select(PATIENT_COLS).eq('community_id', communityId).order('full_name').limit(1000),
        supabase.from('nutri_consultations').select(CONSULT_COLS).eq('community_id', communityId).order('scheduled_on', { ascending: false }).limit(3000),
        supabase.from('nutri_assessments').select('patient_id').eq('community_id', communityId).limit(5000),
        supabase.from('nutri_plans').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'ativo'),
      ])
      if (cancelled) return
      setFailed(!!(p.error || c.error || a.error || pl.error))
      setActivePlans(pl.count ?? 0)
      setPatients((p.data as Patient[] | null) ?? [])
      setConsultations((c.data as Consultation[] | null) ?? [])
      setAssessedIds(new Set(((a.data as { patient_id: string }[] | null) ?? []).map((r) => r.patient_id)))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const savePatient = useCallback(
    async (id: string | null, input: PatientInput): Promise<Result & { id?: string }> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const row = { ...input, full_name: input.full_name.trim(), updated_at: new Date().toISOString() }
      if (id) {
        const { error } = await supabase.from('nutri_patients').update(row).eq('id', id)
        if (error) return { error: FAIL }
        void log(communityId, id, 'Dados pessoais', 'editou', 'Cadastro atualizado')
        reload()
        return { error: null, id }
      }
      const { data, error } = await supabase
        .from('nutri_patients')
        .insert({ ...row, community_id: communityId })
        .select('id')
        .single()
      if (error || !data) return { error: FAIL }
      const newId = (data as { id: string }).id
      void log(communityId, newId, 'Dados pessoais', 'criou', 'Paciente cadastrada')
      reload()
      return { error: null, id: newId }
    },
    [communityId, reload],
  )

  const addConsultation = useCallback(
    async (input: Omit<Consultation, 'id'>): Promise<Result> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { error } = await supabase.from('nutri_consultations').insert({ ...input, community_id: communityId })
      if (error) return { error: FAIL }
      void log(communityId, input.patient_id, 'Consultas', 'criou', `${input.kind} ${input.status} em ${input.scheduled_on}`)
      reload()
      return { error: null }
    },
    [communityId, reload],
  )

  return { patients, consultations, assessedIds, activePlans, loading, failed, reload, savePatient, addConsultation }
}

/** Prontuário de um paciente: avaliações, anamnese, consultas e histórico de alterações. */
export function usePatientRecord(patientId: string, communityId: string) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [anamnesis, setAnamnesis] = useState<{ data: AnamnesisData; status: 'rascunho' | 'concluida'; updated_at: string } | null>(null)
  const [history, setHistory] = useState<{ id: string; section: string; action: string; summary: string | null; at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [a, c, n, h] = await Promise.all([
        supabase.from('nutri_assessments').select(ASSESS_COLS).eq('patient_id', patientId).order('assessed_on').limit(500),
        supabase.from('nutri_consultations').select(CONSULT_COLS).eq('patient_id', patientId).order('scheduled_on', { ascending: false }).limit(500),
        supabase.from('nutri_anamneses').select('data,status,updated_at').eq('patient_id', patientId).maybeSingle(),
        supabase.from('nutri_record_log').select('id,section,action,summary,at').eq('patient_id', patientId).order('at', { ascending: false }).limit(100),
      ])
      if (cancelled) return
      setAssessments((a.data as Assessment[] | null) ?? [])
      setConsultations((c.data as Consultation[] | null) ?? [])
      setAnamnesis((n.data as { data: AnamnesisData; status: 'rascunho' | 'concluida'; updated_at: string } | null) ?? null)
      setHistory((h.data as typeof history | null) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const saveAnamnesis = useCallback(
    async (data: AnamnesisData, status: 'rascunho' | 'concluida'): Promise<Result> => {
      const { error } = await supabase
        .from('nutri_anamneses')
        .upsert(
          { patient_id: patientId, community_id: communityId, data, status, updated_at: new Date().toISOString() },
          { onConflict: 'patient_id' },
        )
      if (error) return { error: FAIL }
      void log(communityId, patientId, 'Anamnese', 'editou', status === 'concluida' ? 'Anamnese concluída' : 'Rascunho salvo')
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  const addAssessment = useCallback(
    async (input: AssessmentInput): Promise<Result> => {
      const { error } = await supabase.from('nutri_assessments').insert({ ...input, patient_id: patientId, community_id: communityId })
      if (error) return { error: FAIL }
      void log(communityId, patientId, 'Avaliação', 'criou', `Avaliação de ${input.assessed_on}`)
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  const removeAssessment = useCallback(
    async (id: string, on: string): Promise<Result> => {
      const { error } = await supabase.from('nutri_assessments').delete().eq('id', id)
      if (error) return { error: FAIL }
      void log(communityId, patientId, 'Avaliação', 'excluiu', `Avaliação de ${on}`)
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  const addConsultation = useCallback(
    async (input: Omit<Consultation, 'id' | 'patient_id'>): Promise<Result> => {
      const { error } = await supabase.from('nutri_consultations').insert({ ...input, patient_id: patientId, community_id: communityId })
      if (error) return { error: FAIL }
      void log(communityId, patientId, 'Consultas', 'criou', `${input.kind} ${input.status} em ${input.scheduled_on}`)
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  const setConsultationStatus = useCallback(
    async (id: string, status: Consultation['status'], evolution?: string | null, nextReturn?: string | null): Promise<Result> => {
      const patch: Record<string, unknown> = { status }
      if (evolution !== undefined) patch.evolution = evolution
      if (nextReturn !== undefined) patch.next_return_on = nextReturn
      const { error } = await supabase.from('nutri_consultations').update(patch).eq('id', id)
      if (error) return { error: FAIL }
      void log(communityId, patientId, 'Consultas', 'editou', `Consulta marcada como ${status}`)
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  return { assessments, consultations, anamnesis, history, loading, saveAnamnesis, addAssessment, removeAssessment, addConsultation, setConsultationStatus }
}
