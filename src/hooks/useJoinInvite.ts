import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearInviteToken } from '../lib/inviteToken'

// Entrada na comunidade pelo link de convite: assim que existe sessão e
// um token guardado, chama `join_community_by_invite`. O App espera este
// hook terminar ANTES de montar o Dashboard, para que a comunidade já
// exista quando o Dashboard buscar as comunidades da pessoa.
export type JoinInviteState =
  | { status: 'idle' }
  | { status: 'joining' }
  | { status: 'error'; message: string }

function messageFor(code: string | undefined, text: string | undefined): string {
  const haystack = `${code ?? ''} ${text ?? ''}`
  if (haystack.includes('invalid_invite') || code === 'P0002') {
    return 'Este convite não está mais ativo. Peça um link novo para quem te convidou.'
  }
  if (haystack.includes('not_active')) {
    return 'Seu acesso a esta comunidade não está liberado. Fale com quem te convidou.'
  }
  return 'Não foi possível entrar na comunidade agora. Tente novamente.'
}

export function useJoinInvite(userId: string | null, token: string | null, onFinished: () => void) {
  const [state, setState] = useState<JoinInviteState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!userId || !token) return
    let cancelled = false
    setState({ status: 'joining' })

    void supabase.rpc('join_community_by_invite', { p_token: token }).then(({ error }) => {
      if (cancelled) return
      if (!error) {
        clearInviteToken()
        setState({ status: 'idle' })
        onFinished()
        return
      }
      // Profissional/Master abrindo um link de participante: não é erro de
      // verdade, só não se aplica — descarta o token e segue o app normal.
      if (`${error.message}`.includes('not_member')) {
        clearInviteToken()
        setState({ status: 'idle' })
        onFinished()
        return
      }
      setState({ status: 'error', message: messageFor(error.code, error.message) })
    })

    return () => {
      cancelled = true
    }
    // onFinished muda a cada render do App; só reexecuta por usuário/token/tentativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const dismiss = useCallback(() => {
    clearInviteToken()
    setState({ status: 'idle' })
    onFinished()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, retry, dismiss }
}
