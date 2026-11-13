import { useEffect, useState } from 'react'
import { isCommunityMediaPath } from '../lib/communityMedia'
import { getSignedUrl, peekSignedUrl } from '../lib/signedUrlCache'

const DEFAULT_EXPIRES_IN = 7 * 24 * 3600 // 7 dias: URL estável entre sessões = cache do navegador

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
 * Os pedidos passam por lib/signedUrlCache: cache em memória e pedidos
 * simultâneos juntos numa só chamada ao Storage (antes era uma por imagem).
 */
export function useSignedImageUrl(
  value: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRES_IN,
) {
  const [url, setUrl] = useState<string | null>(() =>
    value && isCommunityMediaPath(value) ? peekSignedUrl(value, expiresIn) : null,
  )
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

    const cached = peekSignedUrl(value, expiresIn)
    if (cached) {
      setUrl(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    getSignedUrl(value, expiresIn).then((signed) => {
      if (!active) return
      setUrl(signed)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [value, expiresIn])

  return { url, loading }
}
