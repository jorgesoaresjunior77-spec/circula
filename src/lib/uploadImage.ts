import { supabase } from './supabase'

/**
 * Upload de imagem para o Storage do Supabase.
 *
 * Reaproveita o bucket público `avatars` já existente — o mesmo que
 * `useAuth.uploadAvatar` e `usePosts.uploadPostImage` usam. Nenhum
 * bucket novo, nenhuma policy nova: a policy de INSERT de `avatars`
 * exige que a primeira pasta do caminho seja `auth.uid()`, então o
 * caminho aqui é `${uid}/covers/<timestamp>.<ext>`. O bucket é público,
 * logo a URL retornada por `getPublicUrl` é estável e reabre após reload.
 */

const BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export interface UploadImageResult {
  url: string | null
  error: string | null
}

export async function uploadCoverImage(
  file: File,
  uid: string,
): Promise<UploadImageResult> {
  if (!uid) {
    return { url: null, error: 'Sem sessão ativa. Entre novamente para enviar imagens.' }
  }

  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Selecione um arquivo de imagem (JPG, PNG, WebP...).' }
  }

  if (file.size > MAX_BYTES) {
    return { url: null, error: 'A imagem precisa ter no máximo 5 MB.' }
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${uid}/covers/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type })

  if (uploadError) {
    return { url: null, error: uploadError.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
