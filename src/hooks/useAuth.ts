import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, ProfileUpdateInput } from '../types/profile'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitializing(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }
      if (event === 'SIGNED_OUT') {
        setRecoveryMode(false)
      }
      setSession(newSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, avatar_url, interests, bio, city')
      .eq('id', session.user.id)
      .single()

    setProfile(error ? null : data)
  }, [session])

  useEffect(() => {
    let active = true

    refreshProfile().then(() => {
      if (!active) return
    })

    return () => {
      active = false
    }
  }, [refreshProfile])

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(input: ProfileUpdateInput) {
    if (!session) return { error: 'Sem sessão ativa.' }

    const { error } = await supabase.from('profiles').update(input).eq('id', session.user.id)

    if (error) return { error: error.message }

    await refreshProfile()
    return { error: null }
  }

  async function uploadAvatar(file: File) {
    if (!session) return { error: 'Sem sessão ativa.' }

    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false })

    if (uploadError) return { error: uploadError.message }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', session.user.id)

    if (updateError) return { error: updateError.message }

    await refreshProfile()
    return { error: null }
  }

  return {
    session,
    profile,
    initializing,
    recoveryMode,
    signOut,
    updateProfile,
    uploadAvatar,
  }
}
