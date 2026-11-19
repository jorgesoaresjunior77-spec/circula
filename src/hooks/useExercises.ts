import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BASE_EXERCISES } from '../lib/exerciseCatalog'
import type { ExerciseBase } from '../lib/exerciseCatalog'

// Exercícios: biblioteca (com leitura travada no banco pelo pacote), favoritos,
// histórico, treinos montados, execuções e programa semanal da usuária.

export interface ExerciseItem extends ExerciseBase {
  id: string
  community_id: string
  status: 'draft' | 'published'
}

export interface Workout {
  id: string
  name: string
  item_ids: string[]
}
export interface WorkoutRun {
  id: string
  name: string
  total_items: number
  done_items: number
  duration_sec: number
  finished_at: string
}
export interface WeekEntry {
  weekday: number
  workout_id: string | null
  quick_minutes: number | null
}
export interface ExerciseLog {
  id: string
  item_id: string
  done_on: string
}

type Result = { error: string | null }
const FAIL = 'Não foi possível concluir agora. Tente de novo.'

const ITEM_COLS =
  'id,community_id,slug,name,categories,goals,level,mode,target,sets,rest_sec,pose_start,pose_end,description,steps,muscles,cautions,mistakes,status'

export function useExercises(communityId: string | null, profileId: string | null, enabled: boolean) {
  const [items, setItems] = useState<ExerciseItem[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [runs, setRuns] = useState<WorkoutRun[]>([])
  const [week, setWeek] = useState<WeekEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const reload = useCallback(() => setToken((n) => n + 1), [])

  useEffect(() => {
    if (!communityId || !profileId || !enabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
      const [i, f, l, w, r, wk] = await Promise.all([
        supabase.from('exercise_items').select(ITEM_COLS).eq('community_id', communityId).order('name'),
        supabase.from('exercise_favorites').select('item_id').eq('profile_id', profileId),
        supabase.from('exercise_logs').select('id,item_id,done_on').eq('profile_id', profileId).gte('done_on', since).order('done_on', { ascending: false }),
        supabase.from('exercise_workouts').select('id,name,item_ids').eq('profile_id', profileId).order('created_at', { ascending: false }),
        supabase.from('exercise_workout_runs').select('id,name,total_items,done_items,duration_sec,finished_at').eq('profile_id', profileId).order('finished_at', { ascending: false }).limit(40),
        supabase.from('exercise_week_plan').select('weekday,workout_id,quick_minutes').eq('profile_id', profileId),
      ])
      if (cancelled) return
      setItems((i.data ?? []) as ExerciseItem[])
      setFavorites(new Set(((f.data ?? []) as { item_id: string }[]).map((x) => x.item_id)))
      setLogs((l.data ?? []) as ExerciseLog[])
      setWorkouts((w.data ?? []) as Workout[])
      setRuns((r.data ?? []) as WorkoutRun[])
      setWeek((wk.data ?? []) as WeekEntry[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, enabled, token])

  const run = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>): Promise<Result> => {
      const { error } = await fn()
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const toggleFavorite = (itemId: string) =>
    run(() =>
      favorites.has(itemId)
        ? supabase.from('exercise_favorites').delete().eq('profile_id', profileId ?? '').eq('item_id', itemId)
        : supabase.from('exercise_favorites').insert({ item_id: itemId }),
    )
  const logDone = (itemId: string) => run(() => supabase.from('exercise_logs').insert({ item_id: itemId }))
  const saveWorkout = (name: string, itemIds: string[]) => run(() => supabase.from('exercise_workouts').insert({ name, item_ids: itemIds }))
  const deleteWorkout = (id: string) => run(() => supabase.from('exercise_workouts').delete().eq('id', id))
  const finishRun = (r: { name: string; total: number; done: number; seconds: number }) =>
    run(() => supabase.from('exercise_workout_runs').insert({ name: r.name, total_items: r.total, done_items: r.done, duration_sec: r.seconds }))
  const setWeekDay = (weekday: number, entry: { workout_id: string | null; quick_minutes: number | null } | null) =>
    run(() =>
      entry
        ? supabase.from('exercise_week_plan').upsert({ profile_id: profileId, weekday, ...entry }, { onConflict: 'profile_id,weekday' })
        : supabase.from('exercise_week_plan').delete().eq('profile_id', profileId ?? '').eq('weekday', weekday),
    )

  // ---- administração (dona da comunidade) ----
  const importBase = useCallback(async (): Promise<Result & { added: number }> => {
    if (!communityId) return { error: FAIL, added: 0 }
    const have = new Set(items.map((i) => i.slug))
    const rows = BASE_EXERCISES.filter((e) => !have.has(e.slug)).map((e) => ({ ...e, community_id: communityId, status: 'draft' }))
    if (rows.length === 0) return { error: null, added: 0 }
    const { error } = await supabase.from('exercise_items').insert(rows)
    if (error) return { error: FAIL, added: 0 }
    reload()
    return { error: null, added: rows.length }
  }, [communityId, items, reload])

  const saveItem = (id: string, values: Partial<ExerciseItem>) => run(() => supabase.from('exercise_items').update(values).eq('id', id))
  const deleteItem = (id: string) => run(() => supabase.from('exercise_items').delete().eq('id', id))

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  return {
    items,
    byId,
    favorites,
    logs,
    workouts,
    runs,
    week,
    loading,
    toggleFavorite,
    logDone,
    saveWorkout,
    deleteWorkout,
    finishRun,
    setWeekDay,
    importBase,
    saveItem,
    deleteItem,
  }
}

export interface ExercisePreview {
  exercise_count: number
  categories: string[]
  samples: string[]
  articles: { id: string; title: string; description: string | null; category: string | null; cover_path: string | null }[]
}

/** Apresentação antes da compra: números e títulos, sem o conteúdo. */
export function useExercisePreview(communityId: string | null) {
  const [data, setData] = useState<ExercisePreview | null>(null)
  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void supabase.rpc('exercise_preview', { p_community: communityId }).then(({ data: d, error }) => {
      if (!cancelled && !error) setData(d as ExercisePreview)
    })
    return () => {
      cancelled = true
    }
  }, [communityId])
  return data
}
