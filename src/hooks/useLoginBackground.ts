import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage, validateImageFile } from '../lib/imageUpload'

// Foto de fundo da tela de login (9:16). Cadastrada no Painel, lida SEM login.
// A última URL fica guardada no aparelho para a tela já abrir com a foto.
const CACHE_KEY = 'circula.loginBackground'

function readCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY)
  } catch {
    return null
  }
}
function writeCache(url: string | null) {
  try {
    if (url) localStorage.setItem(CACHE_KEY, url)
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* sem armazenamento: segue sem cache */
  }
}

export async function fetchLoginBackground(): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('app_public_settings').select('value').eq('key', 'login_background').maybeSingle()
    if (error) return null
    const url = (data?.value as string | null | undefined) ?? null
    writeCache(url)
    return url
  } catch {
    return null
  }
}

/** URL da foto de fundo do login (ou null: usa o degradê). */
export function useLoginBackground(): string | null {
  const [url, setUrl] = useState<string | null>(readCache)
  useEffect(() => {
    let active = true
    void fetchLoginBackground().then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [])
  return url
}

/** Envia a foto (já recortada em 9:16) para o bucket público e a grava como fundo do login. */
export async function saveLoginBackground(uid: string, originalFile: File): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateImageFile(originalFile)
  if (invalid) return { url: null, error: invalid }
  const file = await compressImage(originalFile)
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${uid}/login/${Date.now()}.${extension}`
  const { error: upError } = await supabase.storage.from('avatars').upload(path, file, { upsert: false, cacheControl: '31536000' })
  if (upError) return { url: null, error: 'Não foi possível enviar a imagem agora.' }
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const { error } = await supabase.rpc('set_login_background', { p_url: url })
  if (error) return { url: null, error: 'Não foi possível salvar o fundo agora.' }
  writeCache(url)
  return { url, error: null }
}

export async function clearLoginBackground(): Promise<string | null> {
  const { error } = await supabase.rpc('set_login_background', { p_url: null })
  if (error) return 'Não foi possível remover agora.'
  writeCache(null)
  return null
}
