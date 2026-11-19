import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A paciente só vê o botão "Nutri" se a nutricionista já a vinculou: a função
// get_my_nutri_plan() devolve algo apenas para pacientes vinculadas. A
// decisão fica no banco (a interface só esconde ou mostra o botão).
export function useIsNutriPatient(enabled: boolean): boolean {
  const [isPatient, setIsPatient] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void supabase.rpc('get_my_nutri_plan').then(({ data, error }) => {
      if (!cancelled) setIsPatient(!error && data != null)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return enabled && isPatient
}
