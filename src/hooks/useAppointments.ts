import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Agenda pessoal do membro (tabela `member_appointments`, RLS: só o dono).
export interface Appointment {
  id: string
  title: string
  notes: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
}

export interface AppointmentInput {
  title: string
  notes: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
}

const COLUMNS = 'id, title, notes, starts_at, ends_at, all_day'

/**
 * Compromissos entre `fromIso` (inclusive) e `toIso` (exclusivo), em ordem
 * de data. `loading` é derivado: enquanto a chave da consulta atual não
 * foi carregada, está carregando.
 */
export function useAppointments(profileId: string | null, fromIso: string, toIso: string) {
  const key = `${profileId ?? ''}|${fromIso}|${toIso}`
  const [loaded, setLoaded] = useState<{ key: string; items: Appointment[]; error: string | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('member_appointments')
        .select(COLUMNS)
        .eq('profile_id', profileId)
        .gte('starts_at', fromIso)
        .lt('starts_at', toIso)
        .order('starts_at', { ascending: true })
      if (cancelled) return
      setLoaded({
        key,
        items: (data ?? []) as Appointment[],
        error: error ? 'Não foi possível carregar sua agenda agora.' : null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [profileId, fromIso, toIso, key, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const add = useCallback(
    async (input: AppointmentInput): Promise<{ error: string | null }> => {
      if (!profileId) return { error: 'Entre na sua conta para salvar.' }
      const { error } = await supabase
        .from('member_appointments')
        .insert({ ...input, profile_id: profileId })
      if (error) return { error: 'Não foi possível salvar o compromisso. Tente de novo.' }
      reload()
      return { error: null }
    },
    [profileId, reload],
  )

  const update = useCallback(
    async (id: string, input: AppointmentInput): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('member_appointments').update(input).eq('id', id)
      if (error) return { error: 'Não foi possível salvar as alterações. Tente de novo.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  const remove = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('member_appointments').delete().eq('id', id)
      if (error) return { error: 'Não foi possível excluir o compromisso. Tente de novo.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  const current = loaded && loaded.key === key ? loaded : null
  return {
    items: current?.items ?? [],
    loading: !!profileId && current === null,
    error: current?.error ?? null,
    add,
    update,
    remove,
  }
}
