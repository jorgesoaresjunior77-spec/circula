import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Presença em tempo real (Supabase Realtime Presence) — conta quantas
// pessoas da comunidade estão com a Home aberta agora. 100% client-side:
// nenhuma tabela, policy ou migration nova, só um canal efêmero por
// comunidade. useCommunityPresence(null, null) não entra em canal nenhum.
export function useCommunityPresence(communityId: string | null, profileId: string | null) {
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!communityId || !profileId) {
      setOnlineCount(0)
      return
    }

    const channel = supabase.channel(`presence-community-${communityId}`, {
      config: { presence: { key: profileId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [communityId, profileId])

  return onlineCount
}
