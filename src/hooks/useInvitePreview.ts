import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Pré-visualização pública do convite (nome da comunidade) — RPC
// `get_invite_preview`, aberta a quem ainda não tem conta.
export type InvitePreview =
  | { status: 'loading' }
  | { status: 'valid'; communityName: string }
  | { status: 'invalid' }

export function useInvitePreview(token: string | null): InvitePreview {
  const [result, setResult] = useState<{ token: string; preview: InvitePreview } | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    void supabase.rpc('get_invite_preview', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return
      const name = Array.isArray(data) ? data[0]?.community_name : null
      setResult({
        token,
        preview: !error && typeof name === 'string' ? { status: 'valid', communityName: name } : { status: 'invalid' },
      })
    })

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return { status: 'invalid' }
  return result?.token === token ? result.preview : { status: 'loading' }
}
