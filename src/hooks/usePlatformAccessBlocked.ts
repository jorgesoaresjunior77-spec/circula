import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/profile'

export function usePlatformAccessBlocked(profile: Profile | null) {
  const [blocked, setBlocked] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true

    if (!profile || profile.role !== 'professional') {
      setBlocked(false)
      setChecked(true)
      return
    }

    setChecked(false)

    supabase
      .from('subscriptions')
      .select('status')
      .eq('subject', 'platform')
      .eq('profile_id', profile.id)
      .neq('status', 'canceled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setBlocked(data?.status === 'blocked')
        setChecked(true)
      })

    return () => {
      active = false
    }
    // Só id/role são lidos aqui — dependência restrita de propósito para não
    // reexecutar a checagem de bloqueio a cada refresh de perfil (nome, bio,
    // cidade, interesses, avatar), que antes causava remount do Dashboard.
  }, [profile?.id, profile?.role])

  return { blocked, checked }
}
