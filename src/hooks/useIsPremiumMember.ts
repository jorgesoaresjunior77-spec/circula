import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A membro logada tem o Círcula Premium nesta comunidade? Usado no convite
// (bônus de 10% para a convidada). Devolve também o id dela, que vai no link
// para o servidor saber quem indicou. Se a consulta falhar, vale "não".
export function useIsPremiumMember(communityId: string): { premium: boolean; uid: string | null } {
  const [state, setState] = useState<{ premium: boolean; uid: string | null }>({ premium: false, uid: null })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id ?? null
      if (!uid) return
      const { data } = await supabase
        .from('member_package_access')
        .select('package')
        .eq('community_id', communityId)
        .eq('profile_id', uid)
        .eq('package', 'premium')
        .limit(1)
      if (!cancelled) setState({ premium: ((data as unknown[] | null) ?? []).length > 0, uid })
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  return state
}
