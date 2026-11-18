import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// O celular de login da pessoa logada (tabela privada login_phones: cada um só
// lê a própria linha). 'missing' = conta sem celular: o App pede o cadastro.
// Se a consulta falhar, 'error': não trava ninguém na porta.
export type LoginPhoneStatus = 'idle' | 'loading' | 'has' | 'missing' | 'error'

export function useLoginPhone(userId: string | null) {
  const [status, setStatus] = useState<LoginPhoneStatus>(userId ? 'loading' : 'idle')

  useEffect(() => {
    if (!userId) {
      setStatus('idle')
      return
    }
    let active = true
    setStatus('loading')
    supabase
      .from('login_phones')
      .select('phone')
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        setStatus(error ? 'error' : data ? 'has' : 'missing')
      })
    return () => {
      active = false
    }
  }, [userId])

  const markHas = useCallback(() => setStatus('has'), [])
  return { status, markHas }
}
