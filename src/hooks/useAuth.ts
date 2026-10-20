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

// Meu Jardim — garden_color_one/garden_color_two só existem no banco
// depois que a migration 20261018120000_garden_meu_jardim.sql for
// aplicada. `PROFILE_SELECT_BASE` é o select de sempre (sem as 2
// colunas novas); `PROFILE_SELECT_GARDEN` tenta trazê-las também.
const PROFILE_SELECT_BASE = 'id, role, full_name, avatar_url, interests, bio, city, gallery_photos'
const PROFILE_SELECT_GARDEN = `${PROFILE_SELECT_BASE}, garden_color_one, garden_color_two`
// Código Postgres de "coluna inexistente" (42703), repassado pelo
// PostgREST em error.code — é o único caso em que vale tentar de novo
// sem as colunas novas. Qualquer outro erro (rede, RLS, sessão) não é
// escondido: cai no mesmo `setProfile(null)` de sempre.
const UNDEFINED_COLUMN_ERROR_CODE = '42703'

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
      .select(PROFILE_SELECT_GARDEN)
      .eq('id', session.user.id)
      .single()

    if (!error) {
      setProfile(data)
      return
    }

    // Banco ainda sem garden_color_one/garden_color_two (migration do
    // Meu Jardim pendente de aplicação) — refaz a consulta sem elas,
    // para não perder full_name/avatar/etc. só por causa de 2 colunas
    // opcionais que ainda não existem. As duas ficam `null` (mesmo
    // valor que teriam recém-criadas, já que a coluna é nullable).
    if (error.code === UNDEFINED_COLUMN_ERROR_CODE) {
      const fallback = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_BASE)
        .eq('id', session.user.id)
        .single()

      setProfile(
        fallback.error
          ? null
          : { ...fallback.data, garden_color_one: null, garden_color_two: null },
      )
      return
    }

    setProfile(null)
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

  // Perfil (item 10) — upload "cru" de uma foto da galeria: só manda o
  // arquivo pro bucket `avatars` (mesmo de sempre, mesma policy por
  // prefixo `<uid>/...`) e devolve a URL pública. NÃO toca
  // `gallery_photos` — quem chama decide onde a URL entra no array
  // (inclusão/substituição) e persiste via `updateProfile`, exatamente
  // como `CoverImageInput` + `createCircle`/`renameCircle` já fazem
  // noutras telas.
  async function uploadGalleryPhoto(file: File) {
    if (!session) return { url: null, error: 'Sem sessão ativa.' }

    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/gallery/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false })

    if (uploadError) return { url: null, error: uploadError.message }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl, error: null as string | null }
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
    uploadGalleryPhoto,
  }
}
