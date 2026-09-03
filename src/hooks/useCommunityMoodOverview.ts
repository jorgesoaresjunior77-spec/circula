import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityMoodOverviewRow, MoodLevel } from '../types/mood'
import { MOOD_ORDER } from '../types/mood'
import { todayLocalISO } from './useDailyMood'

// Fase 3 — visão AGREGADA do humor da comunidade para a aba Métricas.
//
// Lê a view `community_mood_overview` (contagens por humor/dia, já
// filtrada no banco por owns_community()/is_master()). NUNCA há
// profile_id — é impossível saber quem respondeu cada humor.
// A soma por nível é feita aqui, sobre a janela de período escolhida.

export interface MoodOverview {
  /** Contagem por humor no período. */
  byMood: Record<MoodLevel, number>
  /** Total de registros no período. */
  total: number
}

function windowStartISO(periodDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (periodDays - 1))
  return todayLocalISO(d)
}

export function useCommunityMoodOverview(communityId: string | null, periodDays: number) {
  const [rows, setRows] = useState<CommunityMoodOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const since = windowStartISO(periodDays)

  const fetchRows = useCallback(async () => {
    if (!communityId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_mood_overview')
      .select('community_id,mood,entry_date,entries')
      .eq('community_id', communityId)
      .gte('entry_date', since)

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data as CommunityMoodOverviewRow[] | null) ?? [])
    setLoading(false)
  }, [communityId, since])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const overview = useMemo<MoodOverview>(() => {
    const byMood = {
      very_sad: 0,
      sad: 0,
      neutral: 0,
      happy: 0,
      very_happy: 0,
    } as Record<MoodLevel, number>
    for (const row of rows) {
      if (MOOD_ORDER.includes(row.mood)) byMood[row.mood] += row.entries
    }
    const total = MOOD_ORDER.reduce((sum, m) => sum + byMood[m], 0)
    return { byMood, total }
  }, [rows])

  return { overview, loading, error, refresh: fetchRows }
}
