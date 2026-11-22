import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Imagens das Dicas de Viagem: fundo 9:16 e capas dos cards de estado, cidade
// e "para quem". Uma linha por (comunidade, tipo, chave) em travel_images; o
// arquivo já foi enviado ao bucket community-media, aqui só vai o PATH.

export type TravelImageKind = 'fundo' | 'estado' | 'cidade' | 'publico'

export function useTravelImages(communityId: string | null) {
  const [map, setMap] = useState<Record<string, string>>({})
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('travel_images').select('kind,key,image_path').eq('community_id', communityId)
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const r of (data as { kind: string; key: string; image_path: string }[] | null) ?? []) next[r.kind + '|' + r.key] = r.image_path
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, token])

  const get = useCallback((kind: TravelImageKind, key: string) => map[kind + '|' + key] ?? null, [map])

  const set = useCallback(
    async (kind: TravelImageKind, key: string, path: string): Promise<{ error: string | null }> => {
      if (!communityId) return { error: 'Escolha uma comunidade.' }
      const res = path
        ? await supabase.from('travel_images').upsert({ community_id: communityId, kind, key, image_path: path }, { onConflict: 'community_id,kind,key' })
        : await supabase.from('travel_images').delete().eq('community_id', communityId).eq('kind', kind).eq('key', key)
      if (res.error) return { error: 'Não foi possível salvar a imagem agora.' }
      setToken((n) => n + 1)
      return { error: null }
    },
    [communityId],
  )

  return { get, set }
}
