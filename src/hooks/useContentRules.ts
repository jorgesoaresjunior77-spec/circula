import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EMPTY_RULES } from '../lib/contentSchedule'
import type { ScheduleRules } from '../lib/contentSchedule'

// Regras de conteúdo registradas pela profissional: uma por mês ('yyyy-mm') e
// uma geral ('geral'). Só ela lê e grava (RLS).

type Row = {
  month: string
  production_days: number | null
  posts_per_week: number | null
  frequency: string | null
  posting_rules: string | null
  organization: string | null
}

function fromRow(r: Row): ScheduleRules {
  return {
    month: r.month,
    production_days: r.production_days,
    posts_per_week: r.posts_per_week,
    frequency: r.frequency ?? '',
    posting_rules: r.posting_rules ?? '',
    organization: r.organization ?? '',
  }
}

export function useContentRules(communityId: string | null) {
  const [rules, setRules] = useState<Record<string, ScheduleRules>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('content_schedule_rules')
        .select('month,production_days,posts_per_week,frequency,posting_rules,organization')
        .eq('community_id', communityId)
        .limit(200)
      if (cancelled) return
      const map: Record<string, ScheduleRules> = {}
      for (const r of (data as Row[] | null) ?? []) map[r.month] = fromRow(r)
      setRules(map)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  const get = useCallback((month: string): ScheduleRules => rules[month] ?? EMPTY_RULES(month), [rules])

  const save = useCallback(
    async (value: ScheduleRules): Promise<{ error: string | null }> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { error } = await supabase.from('content_schedule_rules').upsert(
        {
          community_id: communityId,
          month: value.month,
          production_days: value.production_days,
          posts_per_week: value.posts_per_week,
          frequency: value.frequency.trim() || null,
          posting_rules: value.posting_rules.trim() || null,
          organization: value.organization.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'community_id,month' },
      )
      if (error) return { error: 'Não foi possível salvar as regras agora. Tente novamente.' }
      setRules((prev) => ({ ...prev, [value.month]: value }))
      return { error: null }
    },
    [communityId],
  )

  return { loading, get, save }
}
