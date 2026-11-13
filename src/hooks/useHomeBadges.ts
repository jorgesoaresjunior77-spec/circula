import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Bolinhas vermelhas nos cards da Home (estilo iPhone): novidades que
// pedem atenção. Substituem o aviso no sininho para esses casos.
//  - newEvents: eventos futuros criados depois da última visita à página
//    de Eventos (guardado no aparelho).
//  - pendingCircleRequests: pedidos de novo Círculo aguardando a profissional.
// Voltar à aba não precisa reconsultar tudo: só se passou mais de 1 minuto.
const MIN_REFRESH_MS = 60_000
const seenKey = (profileId: string) => `circula:events-seen:${profileId}`

export function useHomeBadges(
  communityId: string | null,
  profileId: string | null,
  isOwner: boolean,
  refreshKey: string,
) {
  const [newEvents, setNewEvents] = useState(0)
  const [pendingCircleRequests, setPendingCircleRequests] = useState(0)
  const [gardenPending, setGardenPending] = useState(false)

  const lastLoadRef = useRef(0)

  const load = useCallback(async () => {
    lastLoadRef.current = Date.now()
    if (!communityId || !profileId) {
      setNewEvents(0)
      setPendingCircleRequests(0)
      return
    }
    let seen = '1970-01-01T00:00:00.000Z'
    try {
      seen = localStorage.getItem(seenKey(profileId)) ?? seen
    } catch {
      /* sem storage: conta tudo */
    }
    const nowIso = new Date().toISOString()
    const ev = await supabase
      .from('community_events')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .gte('starts_at', nowIso)
      .gt('created_at', seen)
      .neq('created_by', profileId)
    setNewEvents(ev.count ?? 0)

    if (isOwner) {
      const rq = await supabase
        .from('circle_requests')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', communityId)
        .eq('status', 'pending')
      setPendingCircleRequests(rq.count ?? 0)
    } else {
      setPendingCircleRequests(0)
    }

    // Meu Jardim: tem desafio hoje e o check ainda não foi feito.
    if (!isOwner) {
      const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(new Date())
        .split('-')
        .map(Number)
      const gm = await supabase
        .from('garden_months')
        .select('id')
        .eq('community_id', communityId)
        .eq('year', p[0])
        .eq('month', p[1])
        .maybeSingle()
      if (gm.data) {
        const ck = await supabase
          .from('garden_checks')
          .select('day', { count: 'exact', head: true })
          .eq('month_id', gm.data.id)
          .eq('profile_id', profileId)
          .eq('day', p[2])
        setGardenPending((ck.count ?? 0) === 0)
      } else {
        setGardenPending(false)
      }
    } else {
      setGardenPending(false)
    }
  }, [communityId, profileId, isOwner])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadRef.current > MIN_REFRESH_MS) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const markEventsSeen = useCallback(() => {
    if (!profileId) return
    try {
      localStorage.setItem(seenKey(profileId), new Date().toISOString())
    } catch {
      /* ignore */
    }
    setNewEvents(0)
  }, [profileId])

  return { newEvents, pendingCircleRequests, gardenPending, markEventsSeen, reload: load }
}
