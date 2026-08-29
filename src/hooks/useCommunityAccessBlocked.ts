import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/profile'

export function useCommunityAccessBlocked(profile: Profile | null, communityId: string) {
  const [blocked, setBlocked] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true

    if (!profile || profile.role !== 'member') {
      setBlocked(false)
      setChecked(true)
      return
    }

    setChecked(false)

    supabase
      .from('subscriptions')
      .select('status')
      .eq('subject', 'community')
      .eq('profile_id', profile.id)
      .eq('community_id', communityId)
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
  }, [profile, communityId])

  return { blocked, checked }
}
