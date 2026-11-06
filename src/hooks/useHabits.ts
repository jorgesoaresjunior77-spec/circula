import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDaysIso, todayParts } from '../lib/weekCalendar'
import { HABITS } from '../lib/habits'
import type { HabitKey } from '../lib/habits'

// ANTES DE TUDO (tabela `habit_checks`, RLS: só o dono). O dia de cada
// check é decidido pelo servidor (hoje, São Paulo); marcar e desmarcar só
// vale para hoje. Dias sem check não geram registro nem penalidade.

export interface HabitDay {
  day: string
  count: number
}

const HISTORY_DAYS = 28

function isoToday(): string {
  const t = todayParts()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

export function useHabits(profileId: string | null) {
  const today = useMemo(() => isoToday(), [])
  const since = useMemo(() => addDaysIso(today, -(HISTORY_DAYS - 1)), [today])

  const [data, setData] = useState<{
    profileId: string
    rows: { day: string; habit: string }[]
    error: string | null
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    void (async () => {
      const { data: rows, error } = await supabase
        .from('habit_checks')
        .select('day, habit')
        .eq('profile_id', profileId)
        .gte('day', since)
      if (cancelled) return
      setData({
        profileId,
        rows: (rows ?? []) as { day: string; habit: string }[],
        error: error ? 'Não foi possível carregar seus hábitos agora.' : null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [profileId, since, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const current = data && data.profileId === profileId ? data : null

  const checkedToday = useMemo(
    () => new Set((current?.rows ?? []).filter((r) => r.day === today).map((r) => r.habit)),
    [current, today],
  )

  const history: HabitDay[] = useMemo(() => {
    const known = new Set<string>(HABITS.map((h) => h.key))
    const counts = new Map<string, number>()
    for (const r of current?.rows ?? []) {
      if (r.day === today || !known.has(r.habit)) continue
      counts.set(r.day, (counts.get(r.day) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
  }, [current, today])

  const toggle = useCallback(
    async (habit: HabitKey): Promise<{ error: string | null }> => {
      if (!profileId) return { error: 'Entre na sua conta para salvar.' }
      const wasChecked = checkedToday.has(habit)
      const { error } = wasChecked
        ? await supabase.from('habit_checks').delete().eq('profile_id', profileId).eq('day', today).eq('habit', habit)
        : await supabase.from('habit_checks').insert({ profile_id: profileId, habit })
      if (error) return { error: 'Não foi possível salvar agora. Tente de novo.' }
      reload()
      return { error: null }
    },
    [profileId, checkedToday, today, reload],
  )

  return {
    today,
    loading: !!profileId && current === null,
    error: current?.error ?? null,
    checkedToday,
    history,
    toggle,
  }
}
