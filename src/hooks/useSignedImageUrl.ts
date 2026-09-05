import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isCommunityMediaPath } from '../lib/communityMedia'

const BUCKET = 'community-media'
const DEFAULT_EXPIRES_IN = 3600 // 1 hora

/**
 * Fase 12.5B — resolve um valor salvo em `posts.image_url` /
 * `*.cover_image_url` para uma URL exibível em `<img src>`:
 *
 *  - vazio/null -> `url: null`;
 *  - URL pública já completa (arquivo enviado antes da 12.5A, bucket
 *    `avatars`) -> devolvida direto, SEM pedir signed URL nenhuma —
 *    nunca tenta assinar uma URL pública antiga;
 *  - path novo do bucket `community-media` -> pede uma signed URL ao
 *    Storage. A MESMA policy de SELECT de `storage.objects` (dona OU
 *    membro ativo da comunidade) decide se o pedido é autorizado —
 *    sem permissão, `url` fica `null` e a imagem simplesmente não
 *    aparece (não é tratado como erro de aplicação).
 *
 * Uma instância por imagem, sem cache/batch nesta fase — reavaliar se
 * um dia isso pesar em telas com muitas imagens de uma vez.
 */
export function useSignedImageUrl(
  value: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRES_IN,
) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    if (!value) {
      setUrl(null)
      setLoading(false)
      return
    }

    if (!isCommunityMediaPath(value)) {
      setUrl(value)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(value, expiresIn)
      .then(({ data, error }) => {
        if (!active) return
        setUrl(error ? null : (data?.signedUrl ?? null))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [value, expiresIn])

  return { url, loading }
}
