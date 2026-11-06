import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDaysIso, todayParts } from '../lib/weekCalendar'

// Calculadora de água (tabelas `water_profiles` e `water_logs`, RLS: só o dono).
// O dia de cada registro é decidido pelo servidor (hoje, São Paulo).

export interface WaterLog {
  id: string
  day: string
  amount_ml: number
}

export interface WaterDay {
  day: string
  totalMl: number
}

const HISTORY_DAYS = 14

function isoToday(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function useWater(profileId: string | null) {
  const today = useMemo(() => isoToday(), [])
  const since = useMemo(() => addDaysIso(today, -(HISTORY_DAYS - 1)), [today])

  const [data, setData] = useState<{
    profileId: string
    weightKg: number | null
    logs: WaterLog[]
    error: string | null
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    void (async () => {
      const [weightRes, logsRes] = await Promise.all([
        supabase.from('water_profiles').select('weight_kg').eq('profile_id', profileId).maybeSingle(),
        supabase
          .from('water_logs')
          .select('id, day, amount_ml')
          .eq('profile_id', profileId)
          .gte('day', since)
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setData({
        profileId,
        weightKg: weightRes.data ? Number(weightRes.data.weight_kg) : null,
        logs: (logsRes.data ?? []) as WaterLog[],
        error: weightRes.error || logsRes.error ? 'Não foi possível carregar seus registros de água agora.' : null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [profileId, since, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const current = data && data.profileId === profileId ? data : null
  const logs = current?.logs ?? []
  const todayLogs = logs.filter((l) => l.day === today)
  const todayTotalMl = todayLogs.reduce((sum, l) => sum + l.amount_ml, 0)

  const history: WaterDay[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const l of current?.logs ?? []) {
      if (l.day === today) continue
      totals.set(l.day, (totals.get(l.day) ?? 0) + l.amount_ml)
    }
    return [...totals.entries()]
      .map(([day, totalMl]) => ({ day, totalMl }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
  }, [current, today])

  const saveWeight = useCallback(
    async (kg: number): Promise<{ error: string | null }> => {
      if (!profileId) return { error: 'Entre na sua conta para salvar.' }
      const { error } = await supabase
        .from('water_profiles')
        .upsert({ profile_id: profileId, weight_kg: kg }, { onConflict: 'profile_id' })
      if (error) return { error: 'Não foi possível salvar o peso. Tente de novo.' }
      reload()
      return { error: null }
    },
    [profileId, reload],
  )

  const clearWeight = useCallback(async (): Promise<{ error: string | null }> => {
    if (!profileId) return { error: null }
    const { error } = await supabase.from('water_profiles').delete().eq('profile_id', profileId)
    if (error) return { error: 'Não foi possível apagar o peso. Tente de novo.' }
    reload()
    return { error: null }
  }, [profileId, reload])

  const addLog = useCallback(
    async (ml: number): Promise<{ error: string | null }> => {
      if (!profileId) return { error: 'Entre na sua conta para salvar.' }
      const { error } = await supabase.from('water_logs').insert({ profile_id: profileId, amount_ml: ml })
      if (error) return { error: 'Não foi possível registrar a água. Tente de novo.' }
      reload()
      return { error: null }
    },
    [profileId, reload],
  )

  const updateLog = useCallback(
    async (id: string, ml: number): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('water_logs').update({ amount_ml: ml }).eq('id', id)
      if (error) return { error: 'Não foi possível corrigir o registro. Tente de novo.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  const removeLog = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('water_logs').delete().eq('id', id)
      if (error) return { error: 'Não foi possível remover o registro. Tente de novo.' }
      reload()
      return { error: null }
    },
    [reload],
  )

  return {
    today,
    loading: !!profileId && current === null,
    error: current?.error ?? null,
    weightKg: current?.weightKg ?? null,
    todayLogs,
    todayTotalMl,
    history,
    saveWeight,
    clearWeight,
    addLog,
    updateLog,
    removeLog,
  }
}
