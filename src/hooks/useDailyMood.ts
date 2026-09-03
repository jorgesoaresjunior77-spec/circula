import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CommunityMoodMessage,
  DailyMoodEntry,
  MoodLevel,
  MoodResult,
} from '../types/mood'
import { MOOD_DEFAULT_MESSAGE } from '../types/mood'

// Fase 3 — humor diário. Molde de useContent/useEvents.
//
// PRIVACIDADE: só busca o PRÓPRIO registro do dia (a RLS de
// daily_mood_entries já garante isso, mas o filtro por profile_id deixa
// a intenção explícita). Nenhuma leitura de humor alheio.
//
// useDailyMood(null, ...) ou (..., null) não faz fetch (Master, ou Home
// sem comunidade em foco).

/** Data local no formato YYYY-MM-DD (o "hoje" da usuária, não UTC). */
export function todayLocalISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const ENTRY_SELECT =
  'id,profile_id,community_id,mood,note,entry_date,created_at,updated_at'
const MESSAGE_SELECT =
  'id,community_id,mood,message,is_active,created_by,created_at,updated_at'

export function useDailyMood(profileId: string | null, communityId: string | null) {
  const [entry, setEntry] = useState<DailyMoodEntry | null>(null)
  const [messages, setMessages] = useState<CommunityMoodMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayLocalISO()

  const fetchAll = useCallback(async () => {
    if (!profileId || !communityId) {
      setEntry(null)
      setMessages([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [entryRes, messagesRes] = await Promise.all([
      supabase
        .from('daily_mood_entries')
        .select(ENTRY_SELECT)
        .eq('profile_id', profileId)
        .eq('community_id', communityId)
        .eq('entry_date', today)
        .maybeSingle(),
      supabase
        .from('community_mood_messages')
        .select(MESSAGE_SELECT)
        .eq('community_id', communityId)
        .eq('is_active', true),
    ])

    if (entryRes.error) {
      setError(entryRes.error.message)
      setEntry(null)
      setMessages([])
      setLoading(false)
      return
    }

    setEntry((entryRes.data as DailyMoodEntry | null) ?? null)
    // Uma falha só nas mensagens não derruba o card: cai nos padrões.
    setMessages(
      messagesRes.error ? [] : ((messagesRes.data as CommunityMoodMessage[] | null) ?? []),
    )
    setLoading(false)
  }, [profileId, communityId, today])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const overrideByMood = useMemo(() => {
    const map = new Map<MoodLevel, string>()
    for (const m of messages) {
      if (m.is_active && m.message.trim()) map.set(m.mood, m.message.trim())
    }
    return map
  }, [messages])

  const messageFor = useCallback(
    (mood: MoodLevel): string => overrideByMood.get(mood) ?? MOOD_DEFAULT_MESSAGE[mood],
    [overrideByMood],
  )

  async function setMood(mood: MoodLevel, note?: string | null): Promise<MoodResult> {
    if (!profileId || !communityId) return { error: 'Sem comunidade selecionada.' }

    setSaving(true)
    setError(null)

    const cleanNote = (note ?? '').trim() || null
    const { data, error: upsertError } = await supabase
      .from('daily_mood_entries')
      .upsert(
        {
          profile_id: profileId,
          community_id: communityId,
          entry_date: today,
          mood,
          note: cleanNote,
        },
        { onConflict: 'profile_id,community_id,entry_date' },
      )
      .select(ENTRY_SELECT)
      .maybeSingle()

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return { error: upsertError.message }
    }

    if (data) setEntry(data as DailyMoodEntry)
    return { error: null }
  }

  return {
    todayMood: entry?.mood ?? null,
    todayNote: entry?.note ?? null,
    hasAnswered: !!entry,
    loading,
    saving,
    error,
    messageFor,
    setMood,
    refresh: fetchAll,
  }
}
