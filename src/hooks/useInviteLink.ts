import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildInviteUrl } from '../lib/inviteToken'

// Link de convite da comunidade, do lado da Profissional (dona). Tudo
// passa pelas RPCs `get_invite_link` (só lê), `get_or_create_invite_link`,
// `regenerate_invite_link` e `revoke_invite_link` — a tabela não tem
// acesso direto. Desativar persiste: ao recarregar, `get_invite_link`
// continua devolvendo `null` até a dona gerar outro.
export function useInviteLink(communityId: string) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('get_invite_link', { p_community_id: communityId }).then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError('Não foi possível carregar o link de convite.')
      else setToken(typeof data === 'string' ? data : null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [communityId])

  const run = useCallback(
    async (fn: 'get_or_create_invite_link' | 'regenerate_invite_link' | 'revoke_invite_link') => {
      setBusy(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc(fn, { p_community_id: communityId })
      setBusy(false)
      if (rpcError) {
        setError('Não foi possível atualizar o link de convite. Tente novamente.')
        return
      }
      setToken(fn === 'revoke_invite_link' ? null : typeof data === 'string' ? data : null)
    },
    [communityId],
  )

  return {
    token,
    url: token ? buildInviteUrl(token) : null,
    loading,
    busy,
    error,
    create: useCallback(() => run('get_or_create_invite_link'), [run]),
    regenerate: useCallback(() => run('regenerate_invite_link'), [run]),
    revoke: useCallback(() => run('revoke_invite_link'), [run]),
  }
}
