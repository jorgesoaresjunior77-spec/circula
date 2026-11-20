import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Plan } from '../lib/nutriPlan'

// Área Nutri da paciente. Tudo vem de get_my_nutri_area() (só o que a
// nutricionista compartilhou). Medidas e fotos são da própria paciente e ficam
// em tabelas/bucket privados: só ela e a nutricionista leem.

export interface NutriAppointment {
  id: string
  kind: 'consulta' | 'retorno'
  status: 'agendada' | 'realizada' | 'cancelada'
  scheduled_on: string
  scheduled_time: string | null
  patient_request: 'reagendar' | null
  canceled_by: 'paciente' | 'nutri' | null
}

export interface NutriUpdate {
  id: string
  kind: 'orientacao' | 'tarefa' | 'mensagem'
  title: string
  body: string | null
  done_at: string | null
  created_at: string
}

export interface NutriArea {
  patient_id: string
  community_id: string
  patient_name: string
  exempt: boolean
  plan: Pick<Plan, 'name' | 'objective' | 'start_date' | 'review_date' | 'kcal_target' | 'protein_g_target' | 'carb_g_target' | 'fat_g_target' | 'fiber_g_target' | 'water_ml_target' | 'goals' | 'guidance' | 'meals'> | null
  next_consultation: string | null
  evolution: {
    assessed_on: string
    weight_kg: number | null
    height_cm?: number | null
    waist_cm: number | null
    hip_cm?: number | null
    arm_cm?: number | null
    thigh_cm?: number | null
    calf_cm?: number | null
    body_fat_pct: number | null
    fat_mass_kg?: number | null
    muscle_mass_kg: number | null
  }[]
  appointments: NutriAppointment[]
  updates: NutriUpdate[]
}

export interface BodyEntry {
  id: string
  taken_on: string
  arm_cm: number | null
  thigh_cm: number | null
  waist_cm: number | null
  abdomen_cm: number | null
  hip_cm: number | null
  other_label: string | null
  other_cm: number | null
  notes: string | null
  source: 'paciente' | 'nutri'
}

export interface ProgressPhoto {
  id: string
  taken_on: string
  view: 'frente' | 'lado' | 'costas'
  file_path: string
  source: 'paciente' | 'nutri'
}

export type BodyInput = Partial<Pick<BodyEntry, 'arm_cm' | 'thigh_cm' | 'waist_cm' | 'abdomen_cm' | 'hip_cm' | 'other_label' | 'other_cm' | 'notes'>> & { taken_on: string }

type Result = { error: string | null }
const FAIL = 'Não foi possível concluir agora. Tente de novo.'
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function validatePhoto(file: File): string | null {
  if (file.size > MAX_PHOTO_BYTES) return 'A foto passa de 10 MB.'
  if (file.type && !['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) return 'Envie uma imagem (JPG, PNG ou WebP).'
  return null
}

export async function progressPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('nutri-progress').createSignedUrl(path, 300)
  return data?.signedUrl ?? null
}

export function usePatientNutri() {
  const [area, setArea] = useState<NutriArea | null | undefined>(undefined)
  const [entries, setEntries] = useState<BodyEntry[]>([])
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [token, setToken] = useState(0)
  const reload = useCallback(() => setToken((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.rpc('get_my_nutri_area')
      if (cancelled) return
      const next = error ? null : ((data as NutriArea | null) ?? null)
      setArea(next)
      if (next) {
        const [e, p] = await Promise.all([
          supabase
            .from('nutri_body_entries')
            .select('id,taken_on,arm_cm,thigh_cm,waist_cm,abdomen_cm,hip_cm,other_label,other_cm,notes,source')
            .eq('patient_id', next.patient_id)
            .order('taken_on', { ascending: false }),
          supabase
            .from('nutri_progress_photos')
            .select('id,taken_on,view,file_path,source')
            .eq('patient_id', next.patient_id)
            .order('taken_on', { ascending: false }),
        ])
        if (cancelled) return
        setEntries((e.data ?? []) as BodyEntry[])
        setPhotos((p.data ?? []) as ProgressPhoto[])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const run = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>): Promise<Result> => {
      const { error } = await fn()
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const cancelAppointment = (id: string) => run(() => supabase.rpc('patient_cancel_consultation', { p_id: id }))
  const requestReschedule = (id: string, note: string) => run(() => supabase.rpc('patient_request_reschedule', { p_id: id, p_note: note }))
  const completeTask = (id: string, done: boolean) => run(() => supabase.rpc('complete_nutri_task', { p_id: id, p_done: done }))

  const addEntry = (input: BodyInput) =>
    run(() => {
      if (!area) return Promise.resolve({ error: new Error('no area') })
      return supabase.from('nutri_body_entries').insert({ ...input, patient_id: area.patient_id, community_id: area.community_id, source: 'paciente' })
    })
  const deleteEntry = (id: string) => run(() => supabase.from('nutri_body_entries').delete().eq('id', id))

  const addPhoto = useCallback(
    async (file: File, view: 'frente' | 'lado' | 'costas', takenOn: string): Promise<Result> => {
      if (!area) return { error: FAIL }
      const invalid = validatePhoto(file)
      if (invalid) return { error: invalid }
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
      const path = `${area.community_id}/${area.patient_id}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('nutri-progress').upload(path, file, { contentType: file.type || 'image/jpeg' })
      if (up.error) return { error: FAIL }
      const { error } = await supabase
        .from('nutri_progress_photos')
        .insert({ patient_id: area.patient_id, community_id: area.community_id, taken_on: takenOn, view, file_path: path, source: 'paciente' })
      if (error) {
        await supabase.storage.from('nutri-progress').remove([path])
        return { error: FAIL }
      }
      reload()
      return { error: null }
    },
    [area, reload],
  )

  const deletePhoto = useCallback(
    async (photo: ProgressPhoto): Promise<Result> => {
      const { error } = await supabase.from('nutri_progress_photos').delete().eq('id', photo.id)
      if (error) return { error: FAIL }
      await supabase.storage.from('nutri-progress').remove([photo.file_path])
      reload()
      return { error: null }
    },
    [reload],
  )

  return { area, entries, photos, loading: area === undefined, cancelAppointment, requestReschedule, completeTask, addEntry, deleteEntry, addPhoto, deletePhoto }
}
