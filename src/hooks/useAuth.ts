import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearPersistedSignedUrls } from '../lib/signedUrlCache'
import { checkPreparedImage, compressImage, UPLOAD_CACHE_CONTROL, validateImageFile } from '../lib/imageUpload'
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
const PROFILE_SELECT_BASE = 'id, role, full_name, avatar_url, banner_url, interests, bio, city, gallery_photos'
const PROFILE_SELECT_GARDEN = `${PROFILE_SELECT_BASE}, garden_color_one, garden_color_two`
// Etapa 8/9 (evolução/gamificação) — onboarding_answers/onboarding_completed_at/
// tour_completed_at só existem depois que a migration preparada (NÃO
// aplicada ainda) rodar no remoto. Mesmo padrão de fallback por coluna
// inexistente já usado acima para garden_color_one/two — 3o nível, não
// 2o: tenta com as colunas novas, cai para PROFILE_SELECT_GARDEN (sem
// elas) se a 42703 disparar.
const PROFILE_SELECT_ONBOARDING = `${PROFILE_SELECT_GARDEN}, onboarding_answers, onboarding_completed_at, tour_completed_at`
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
      .select(PROFILE_SELECT_ONBOARDING)
      .eq('id', session.user.id)
      .single()

    if (!error) {
      setProfile(data)
      return
    }

    // Banco ainda sem onboarding_answers/onboarding_completed_at/
    // tour_completed_at (migration da Etapa 8/9 pendente de aplicação)
    // — refaz sem elas. Propositalmente NÃO preenche as 3 com um valor
    // default (nem `null`): ficam `undefined` no objeto, e é esse
    // `undefined` (coluna nunca confirmada) que o Dashboard usa para
    // NUNCA mostrar o onboarding/tour enquanto a migration não tiver
    // sido aplicada — sem isto, toda sessão veria o onboarding de novo
    // a cada carregamento (a conclusão nunca conseguiria ser salva).
    if (error.code === UNDEFINED_COLUMN_ERROR_CODE) {
      const gardenResult = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_GARDEN)
        .eq('id', session.user.id)
        .single()

      if (!gardenResult.error) {
        setProfile(gardenResult.data)
        return
      }

      // Banco também ainda sem garden_color_one/garden_color_two
      // (migration do Meu Jardim pendente) — mesmo princípio, mais um
      // nível: refaz sem elas. As duas ficam `null` (coluna nullable,
      // mesmo valor que teriam recém-criadas) — diferente das 3 de
      // onboarding/tour acima, GardenColorPicker já sabe lidar com
      // `null` sem gatear nenhuma tela por trás disso.
      if (gardenResult.error.code === UNDEFINED_COLUMN_ERROR_CODE) {
        const baseResult = await supabase
          .from('profiles')
          .select(PROFILE_SELECT_BASE)
          .eq('id', session.user.id)
          .single()

        setProfile(
          baseResult.error
            ? null
            : { ...baseResult.data, garden_color_one: null, garden_color_two: null },
        )
        return
      }

      setProfile(null)
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
    clearPersistedSignedUrls()
  }

  async function updateProfile(input: ProfileUpdateInput) {
    if (!session) return { error: 'Sem sessão ativa.' }

    const { error } = await supabase.from('profiles').update(input).eq('id', session.user.id)

    if (error) return { error: error.message }

    await refreshProfile()
    return { error: null }
  }

  async function uploadAvatar(originalFile: File) {
    if (!session) return { error: 'Sem sessão ativa.' }

    const invalid = validateImageFile(originalFile)
    if (invalid) return { error: invalid }
    const file = await compressImage(originalFile)
    const unusable = checkPreparedImage(file)
    if (unusable) return { error: unusable }

    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false, cacheControl: UPLOAD_CACHE_CONTROL })

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
  async function uploadGalleryPhoto(originalFile: File) {
    if (!session) return { url: null, error: 'Sem sessão ativa.' }

    const invalid = validateImageFile(originalFile)
    if (invalid) return { url: null, error: invalid }
    const file = await compressImage(originalFile)
    const unusable = checkPreparedImage(file)
    if (unusable) return { url: null, error: unusable }

    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/gallery/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false, cacheControl: UPLOAD_CACHE_CONTROL })

    if (uploadError) return { url: null, error: uploadError.message }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl, error: null as string | null }
  }

  // Banner do perfil (imagem larga atras da foto): sobe para `avatars`
  // sob <uid>/banner/ e grava a URL em profiles.banner_url.
  async function uploadBanner(originalFile: File) {
    if (!session) return { error: 'Sem sessão ativa.' }
    const invalid = validateImageFile(originalFile)
    if (invalid) return { error: invalid }
    const file = await compressImage(originalFile)
    const unusable = checkPreparedImage(file)
    if (unusable) return { error: unusable }
    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/banner/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: false, cacheControl: UPLOAD_CACHE_CONTROL })
    if (uploadError) return { error: uploadError.message }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ banner_url: data.publicUrl })
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
    uploadBanner,
    uploadGalleryPhoto,
  }
}
