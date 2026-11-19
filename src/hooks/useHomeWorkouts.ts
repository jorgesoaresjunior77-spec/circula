import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BASE_EXERCISES } from '../lib/exerciseCatalog'
import type { ExerciseBase } from '../lib/exerciseCatalog'

// "Se exercite em casa": os exercícios vêm do próprio app; aqui ficam só os
// treinos que a usuária salvou e os treinos que ela já fez (privados).

export type WorkoutExercise = ExerciseBase & { id: string }

export const EXERCISES: WorkoutExercise[] = BASE_EXERCISES.map((e) => ({ ...e, id: e.slug }))
export const EXERCISE_BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e]))

export interface SavedWorkout {
  id: string
  name: string
  item_slugs: string[]
  minutes: number | null
}
export interface WorkoutRun {
  id: string
  name: string
  total_items: number
  done_items: number
  duration_sec: number
  finished_at: string
}

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente de novo.'

export function useHomeWorkouts(profileId: string | null) {
  const [saved, setSaved] = useState<SavedWorkout[]>([])
  const [runs, setRuns] = useState<WorkoutRun[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const reload = useCallback(() => setToken((n) => n + 1), [])

  useEffect(() => {
    if (!profileId) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const [w, r] = await Promise.all([
        supabase.from('exercise_workouts').select('id,name,item_slugs,minutes').eq('profile_id', profileId).order('created_at', { ascending: false }),
        supabase.from('exercise_workout_runs').select('id,name,total_items,done_items,duration_sec,finished_at').eq('profile_id', profileId).order('finished_at', { ascending: false }).limit(30),
      ])
      if (cancelled) return
      setSaved(((w.data ?? []) as SavedWorkout[]).filter((x) => (x.item_slugs ?? []).length > 0))
      setRuns((r.data ?? []) as WorkoutRun[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [profileId, token])

  const run = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>): Promise<Result> => {
      const { error } = await fn()
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const saveWorkout = (name: string, slugs: string[], minutes: number) =>
    run(() => supabase.from('exercise_workouts').insert({ name: name.trim(), item_slugs: slugs, minutes }))
  const deleteWorkout = (id: string) => run(() => supabase.from('exercise_workouts').delete().eq('id', id))
  const finishRun = (r: { name: string; total: number; done: number; seconds: number }) =>
    run(() => supabase.from('exercise_workout_runs').insert({ name: r.name, total_items: r.total, done_items: r.done, duration_sec: r.seconds }))

  return { saved, runs, loading, saveWorkout, deleteWorkout, finishRun }
}
