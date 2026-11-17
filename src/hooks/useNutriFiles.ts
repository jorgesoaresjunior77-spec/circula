import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uid } from '../lib/nutriPlan'

// Exames e documentos do paciente. Os arquivos ficam no bucket PRIVADO
// nutri-files (caminho: comunidade/paciente/arquivo) e só abrem por link
// assinado e temporário.

export interface Exam {
  id: string
  name: string
  collected_on: string
  result: string | null
  unit: string | null
  reference_range: string | null
  notes: string | null
  file_path: string | null
}

export interface NutriDocument {
  id: string
  title: string
  file_path: string
  file_name: string | null
  created_at: string
}

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente novamente.'
export const MAX_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return 'O arquivo passa de 15 MB.'
  if (file.type && !ALLOWED.includes(file.type)) return 'Envie um PDF ou uma imagem (JPG, PNG, WebP).'
  return null
}

function safeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)
}

export async function signedFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('nutri-files').createSignedUrl(path, 120)
  return data?.signedUrl ?? null
}

export function usePatientFiles(patientId: string, communityId: string) {
  const [exams, setExams] = useState<Exam[]>([])
  const [documents, setDocuments] = useState<NutriDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [e, d] = await Promise.all([
        supabase
          .from('nutri_exams')
          .select('id,name,collected_on,result,unit,reference_range,notes,file_path')
          .eq('patient_id', patientId)
          .order('collected_on', { ascending: false })
          .limit(500),
        supabase
          .from('nutri_documents')
          .select('id,title,file_path,file_name,created_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      if (cancelled) return
      setExams((e.data as Exam[] | null) ?? [])
      setDocuments((d.data as NutriDocument[] | null) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const upload = useCallback(
    async (file: File): Promise<{ path: string | null; error: string | null }> => {
      const invalid = validateFile(file)
      if (invalid) return { path: null, error: invalid }
      const path = `${communityId}/${patientId}/${uid()}-${safeName(file.name)}`
      const { error } = await supabase.storage.from('nutri-files').upload(path, file, { contentType: file.type || undefined })
      if (error) return { path: null, error: 'Não foi possível enviar o arquivo agora.' }
      return { path, error: null }
    },
    [communityId, patientId],
  )

  const log = useCallback(
    (section: string, action: 'criou' | 'excluiu', summary: string) =>
      supabase.from('nutri_record_log').insert({ community_id: communityId, patient_id: patientId, section, action, summary: summary.slice(0, 200) }),
    [communityId, patientId],
  )

  const addExam = useCallback(
    async (input: Omit<Exam, 'id' | 'file_path'>, file: File | null): Promise<Result> => {
      let file_path: string | null = null
      if (file) {
        const up = await upload(file)
        if (up.error) return { error: up.error }
        file_path = up.path
      }
      const { error } = await supabase.from('nutri_exams').insert({ ...input, file_path, patient_id: patientId, community_id: communityId })
      if (error) return { error: FAIL }
      void log('Exames', 'criou', input.name)
      reload()
      return { error: null }
    },
    [upload, patientId, communityId, log, reload],
  )

  const removeExam = useCallback(
    async (e: Exam): Promise<Result> => {
      const { error } = await supabase.from('nutri_exams').delete().eq('id', e.id)
      if (error) return { error: FAIL }
      if (e.file_path) await supabase.storage.from('nutri-files').remove([e.file_path])
      void log('Exames', 'excluiu', e.name)
      reload()
      return { error: null }
    },
    [log, reload],
  )

  const addDocument = useCallback(
    async (title: string, file: File): Promise<Result> => {
      const up = await upload(file)
      if (up.error || !up.path) return { error: up.error ?? FAIL }
      const { error } = await supabase
        .from('nutri_documents')
        .insert({ title: title.trim(), file_path: up.path, file_name: file.name.slice(0, 200), patient_id: patientId, community_id: communityId })
      if (error) {
        await supabase.storage.from('nutri-files').remove([up.path])
        return { error: FAIL }
      }
      void log('Documentos', 'criou', title)
      reload()
      return { error: null }
    },
    [upload, patientId, communityId, log, reload],
  )

  const removeDocument = useCallback(
    async (d: NutriDocument): Promise<Result> => {
      const { error } = await supabase.from('nutri_documents').delete().eq('id', d.id)
      if (error) return { error: FAIL }
      await supabase.storage.from('nutri-files').remove([d.file_path])
      void log('Documentos', 'excluiu', d.title)
      reload()
      return { error: null }
    },
    [log, reload],
  )

  return { exams, documents, loading, addExam, removeExam, addDocument, removeDocument }
}
