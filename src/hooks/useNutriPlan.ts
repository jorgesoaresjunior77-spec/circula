import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FoodRow, Food, Nutrients, Plan } from '../lib/nutriPlan'

// Banco de alimentos, receitas e planos alimentares da nutricionista. Tudo
// passa pela RLS (só a dona da comunidade).

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente novamente.'

const FOOD_COLS = 'id,name,category,portion_label,portion_g,kcal,protein_g,carb_g,fat_g,sat_fat_g,fiber_g,sodium_mg,source'
const PLAN_COLS =
  'id,patient_id,name,objective,start_date,review_date,kcal_target,protein_g_target,carb_g_target,fat_g_target,fiber_g_target,water_ml_target,goals,energy_estimate,notes,guidance,meals,status,shared_with_patient,created_at'

export interface RecipeIngredient {
  id: string
  foodId: string | null
  name: string
  grams: number
  nutrients: Nutrients | null
}

export interface Recipe {
  id: string
  name: string
  yield_portions: number
  portion_g: number | null
  ingredients: RecipeIngredient[]
  preparation: string | null
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

function toFood(r: Record<string, unknown>): Food {
  return {
    id: r.id as string,
    name: r.name as string,
    category: (r.category as string | null) ?? null,
    portion_label: (r.portion_label as string | null) ?? null,
    portion_g: Number(r.portion_g),
    kcal: num(r.kcal),
    protein_g: num(r.protein_g),
    carb_g: num(r.carb_g),
    fat_g: num(r.fat_g),
    sat_fat_g: num(r.sat_fat_g),
    fiber_g: num(r.fiber_g),
    sodium_mg: num(r.sodium_mg),
    source: (r.source as 'propria' | 'importada') ?? 'propria',
  }
}

/** Alimentos e receitas da comunidade. */
export function useNutriLibrary(communityId: string | null) {
  const [foods, setFoods] = useState<Food[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(!!communityId)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const [f, r] = await Promise.all([
        supabase.from('nutri_foods').select(FOOD_COLS).eq('community_id', communityId).order('name').limit(10000),
        supabase
          .from('nutri_recipes')
          .select('id,name,yield_portions,portion_g,ingredients,preparation')
          .eq('community_id', communityId)
          .order('name')
          .limit(1000),
      ])
      if (cancelled) return
      setFoods(((f.data as Record<string, unknown>[] | null) ?? []).map(toFood))
      setRecipes(
        ((r.data as Record<string, unknown>[] | null) ?? []).map((x) => ({
          id: x.id as string,
          name: x.name as string,
          yield_portions: Number(x.yield_portions),
          portion_g: num(x.portion_g),
          ingredients: (x.ingredients as RecipeIngredient[]) ?? [],
          preparation: (x.preparation as string | null) ?? null,
        })),
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const saveFood = useCallback(
    async (id: string | null, row: FoodRow): Promise<Result> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const res = id
        ? await supabase.from('nutri_foods').update(row).eq('id', id)
        : await supabase.from('nutri_foods').insert({ ...row, community_id: communityId, source: 'propria' })
      if (res.error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [communityId, reload],
  )

  const importFoods = useCallback(
    async (rows: FoodRow[]): Promise<Result & { inserted: number }> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.', inserted: 0 }
      let inserted = 0
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((r) => ({ ...r, community_id: communityId, source: 'importada' }))
        const { error } = await supabase.from('nutri_foods').insert(chunk)
        if (error) {
          reload()
          return { error: `Importou ${inserted} alimentos e parou por um erro. Confira o arquivo.`, inserted }
        }
        inserted += chunk.length
      }
      reload()
      return { error: null, inserted }
    },
    [communityId, reload],
  )

  const removeFood = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('nutri_foods').delete().eq('id', id)
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const saveRecipe = useCallback(
    async (id: string | null, r: Omit<Recipe, 'id'>): Promise<Result> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const row = {
        name: r.name.trim(),
        yield_portions: r.yield_portions,
        portion_g: r.portion_g,
        ingredients: r.ingredients,
        preparation: r.preparation?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const res = id
        ? await supabase.from('nutri_recipes').update(row).eq('id', id)
        : await supabase.from('nutri_recipes').insert({ ...row, community_id: communityId })
      if (res.error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [communityId, reload],
  )

  const removeRecipe = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('nutri_recipes').delete().eq('id', id)
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { foods, recipes, loading, saveFood, importFoods, removeFood, saveRecipe, removeRecipe }
}

/** Planos alimentares de um paciente (cada versão é um plano). */
export function usePatientPlans(patientId: string, communityId: string) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('nutri_plans')
        .select(PLAN_COLS)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      setPlans(
        ((data as Record<string, unknown>[] | null) ?? []).map((p) => ({
          ...(p as unknown as Plan),
          kcal_target: num(p.kcal_target),
          protein_g_target: num(p.protein_g_target),
          carb_g_target: num(p.carb_g_target),
          fat_g_target: num(p.fat_g_target),
          fiber_g_target: num(p.fiber_g_target),
          water_ml_target: num(p.water_ml_target),
          meals: (p.meals as Plan['meals']) ?? [],
        })),
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const savePlan = useCallback(
    async (id: string | null, plan: Omit<Plan, 'id' | 'patient_id' | 'created_at'>): Promise<Result> => {
      const row = { ...plan, updated_at: new Date().toISOString() }
      const res = id
        ? await supabase.from('nutri_plans').update(row).eq('id', id)
        : await supabase.from('nutri_plans').insert({ ...row, patient_id: patientId, community_id: communityId })
      if (res.error) return { error: FAIL }
      await supabase.from('nutri_record_log').insert({
        community_id: communityId,
        patient_id: patientId,
        section: 'Planejamento alimentar',
        action: id ? 'editou' : 'criou',
        summary: plan.name.slice(0, 200),
      })
      reload()
      return { error: null }
    },
    [patientId, communityId, reload],
  )

  const copyTo = useCallback(
    async (plan: Plan, targetPatientId: string): Promise<Result> => {
      const { id: _id, patient_id: _pid, created_at: _ca, ...rest } = plan
      void _id
      void _pid
      void _ca
      const row = { ...rest, name: `${plan.name} (cópia)`, status: 'rascunho', shared_with_patient: false, patient_id: targetPatientId, community_id: communityId }
      const { error } = await supabase.from('nutri_plans').insert(row)
      if (error) return { error: FAIL }
      await supabase.from('nutri_record_log').insert({
        community_id: communityId,
        patient_id: targetPatientId,
        section: 'Planejamento alimentar',
        action: 'criou',
        summary: `Cópia do plano "${plan.name}"`.slice(0, 200),
      })
      return { error: null }
    },
    [communityId],
  )

  const setStatus = useCallback(
    async (id: string, status: Plan['status']): Promise<Result> => {
      const { error } = await supabase.from('nutri_plans').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  return { plans, loading, savePlan, setStatus, copyTo }
}
