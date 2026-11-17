import { supabase } from '../lib/supabase'

// LGPD na Gestão Nutricional: consentimento, cópia dos dados e exclusão total
// de uma paciente (a pedido dela). Tudo passa pela RLS da dona da comunidade.

type Result = { error: string | null }
const FAIL = 'Não foi possível concluir agora. Tente novamente.'

export async function setConsent(patientId: string, on: boolean, note: string | null): Promise<Result> {
  const { error } = await supabase
    .from('nutri_patients')
    .update({ consent_at: on ? new Date().toISOString() : null, consent_note: on ? note : null })
    .eq('id', patientId)
  return { error: error ? FAIL : null }
}

/** Reúne tudo o que existe da paciente em um único objeto (para baixar como arquivo). */
export async function collectPatientData(patientId: string): Promise<Record<string, unknown> | null> {
  const tables = ['nutri_anamneses', 'nutri_assessments', 'nutri_consultations', 'nutri_exams', 'nutri_documents', 'nutri_plans', 'nutri_record_log']
  const patient = await supabase.from('nutri_patients').select('*').eq('id', patientId).maybeSingle()
  if (patient.error || !patient.data) return null
  const out: Record<string, unknown> = {
    gerado_em: new Date().toISOString(),
    observacao: 'Cópia dos dados da paciente. Arquivos anexados (exames e documentos) não vêm neste arquivo.',
    paciente: patient.data,
  }
  for (const t of tables) {
    const r = await supabase.from(t).select('*').eq('patient_id', patientId).limit(5000)
    if (r.error) return null
    out[t.replace('nutri_', '')] = r.data
  }
  return out
}

export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Apaga a paciente e tudo o que depende dela, inclusive os arquivos guardados. */
export async function erasePatient(patientId: string): Promise<Result> {
  const paths: string[] = []
  const exams = await supabase.from('nutri_exams').select('file_path').eq('patient_id', patientId).limit(5000)
  const docs = await supabase.from('nutri_documents').select('file_path').eq('patient_id', patientId).limit(5000)
  const photo = await supabase.from('nutri_patients').select('photo_path').eq('id', patientId).maybeSingle()
  if (exams.error || docs.error || photo.error) return { error: FAIL }
  for (const r of (exams.data as { file_path: string | null }[] | null) ?? []) if (r.file_path) paths.push(r.file_path)
  for (const r of (docs.data as { file_path: string | null }[] | null) ?? []) if (r.file_path) paths.push(r.file_path)
  const ph = (photo.data as { photo_path: string | null } | null)?.photo_path
  if (ph) paths.push(ph)

  // Os registros primeiro: se falhar, os arquivos continuam acessíveis.
  const del = await supabase.from('nutri_patients').delete().eq('id', patientId)
  if (del.error) return { error: FAIL }
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from('nutri-files').remove(paths.slice(i, i + 100))
  }
  return { error: null }
}
