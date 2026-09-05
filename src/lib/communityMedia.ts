import { supabase } from './supabase'

/**
 * Fase 12.5B — upload de mídia de comunidade (posts e capas) para o
 * bucket PRIVADO `community-media` (criado na 12.5A). Path:
 *
 *   <community_id>/<kind>/<uploader_uid>/<timestamp>.<ext>
 *
 * O `community_id` como 1o segmento do path é o que as policies de
 * `storage.objects` usam para autorizar leitura/escrita (ver migration
 * `20260913120000_community_media_bucket.sql`) — nenhuma tabela de
 * mapeamento, nenhum parsing de URL.
 *
 * IMPORTANTE: como o bucket é privado, o upload NÃO devolve uma URL
 * pública utilizável — devolve o PATH. É o PATH que deve ser salvo em
 * `posts.image_url` / `*.cover_image_url` (nunca uma signed URL, que
 * expira e não deveria ir para o banco). A leitura resolve o path numa
 * signed URL sob demanda, via `useSignedImageUrl`.
 *
 * Arquivos enviados ANTES da 12.5A continuam sendo URLs públicas
 * completas do bucket `avatars` — não são tocados nem migrados aqui.
 * `isCommunityMediaPath` distingue os dois formatos sem ambiguidade:
 * uma URL sempre começa com `http(s)://`; um path novo nunca começa.
 */

const BUCKET = 'community-media'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — mesmo limite já reforçado no próprio bucket (12.5A)

export type CommunityMediaKind = 'posts' | 'covers'

export interface UploadCommunityMediaResult {
  path: string | null
  error: string | null
}

function sanitizeExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

export async function uploadCommunityMedia(
  file: File,
  communityId: string,
  uid: string,
  kind: CommunityMediaKind,
): Promise<UploadCommunityMediaResult> {
  if (!communityId) {
    return { path: null, error: 'Comunidade não identificada.' }
  }

  if (!uid) {
    return { path: null, error: 'Sem sessão ativa. Entre novamente para enviar imagens.' }
  }

  if (!file.type.startsWith('image/')) {
    return { path: null, error: 'Selecione um arquivo de imagem (JPG, PNG, WebP...).' }
  }

  if (file.size > MAX_BYTES) {
    return { path: null, error: 'A imagem precisa ter no máximo 5 MB.' }
  }

  const extension = sanitizeExtension(file.name)
  const path = `${communityId}/${kind}/${uid}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type })

  if (uploadError) {
    return { path: null, error: uploadError.message }
  }

  return { path, error: null }
}

/**
 * `true` quando o valor salvo é um PATH do bucket `community-media`
 * (formato novo, pós-12.5B); `false` quando é uma URL pública completa
 * (formato antigo do bucket `avatars`, ou qualquer outra URL absoluta)
 * — nesse caso não deve ser assinado, só usado direto como `src`.
 */
export function isCommunityMediaPath(value: string | null | undefined): value is string {
  return !!value && !/^https?:\/\//i.test(value)
}
