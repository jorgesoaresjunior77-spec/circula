import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, ProfileUpdateInput } from '../types/profile'

// Fase 14.2 — capturado no import, ANTES de o gotrue-js consumir e
// limpar o hash da URL. Um link de convite chega como
// `#access_token=...&type=invite&...`; um link expirado/inválido chega
// como `#error=...&error_code=...` (sem `type`). `type=recovery` NÃO é
// tratado aqui — a recuperação de senha continua no seu próprio caminho
// (evento `PASSWORD_RECOVERY`).
const INITIAL_HASH_PARAMS = new URLSearchParams(
  typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '',
)
// Só um link de convite REAL do Supabase dispara o primeiro acesso:
// `type=invite` E um `access_token` no hash. Um `#type=invite` avulso
// (ou uma sessão pré-existente) não força a tela de definição de senha.
const INITIAL_IS_INVITE =
  INITIAL_HASH_PARAMS.get('type') === 'invite' && !!INITIAL_HASH_PARAMS.get('access_token')
const INITIAL_INVITE_ERROR =
  INITIAL_HASH_PARAMS.get('error') || INITIAL_HASH_PARAMS.get('error_code')
    ? 'Este convite expirou ou já foi utilizado. Peça um novo convite à responsável pela comunidade.'
    : null

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  // Fase 14.2 — primeiro acesso via convite: enquanto `true`, a nova
  // Member precisa definir a senha antes de entrar no Dashboard.
  const [mustSetPassword, setMustSetPassword] = useState(INITIAL_IS_INVITE)
  const [inviteError, setInviteError] = useState<string | null>(INITIAL_INVITE_ERROR)

  const clearInviteState = useCallback(() => {
    setMustSetPassword(false)
    setInviteError(null)
  }, [])

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
        setMustSetPassword(false)
        setInviteError(null)
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
    mustSetPassword,
    inviteError,
    clearInviteState,
    signOut,
    updateProfile,
    uploadAvatar,
  }
}
