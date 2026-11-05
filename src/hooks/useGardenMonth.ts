import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Meu Jardim — desafio do mês (28 a 31 dias), um check por dia.
export interface GardenMonth {
  id: string
  year: number
  month: number
  title: string | null
  days: number
  texts: Record<number, string>
}

/** Data de hoje no fuso de São Paulo (o dia vira à meia-noite de lá). */
export function spToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [year, month, day] = parts.split('-').map(Number)
  return { year, month, day }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function useGardenMonth(communityId: string | null, profileId: string | null) {
  const today = spToday()
  const [months, setMonths] = useState<GardenMonth[]>([])
  // chave `${monthId}:${day}` das marcações da própria usuária
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!communityId || !profileId) {
      setLoading(false)
      return
    }
    const [m, c] = await Promise.all([
      supabase
        .from('garden_months')
        .select('id,year,month,title,days,garden_month_days(day,body)')
        .eq('community_id', communityId)
        .eq('year', spToday().year),
      supabase
        .from('garden_checks')
        .select('month_id,day')
        .eq('community_id', communityId)
        .eq('profile_id', profileId),
    ])
    const rows = (m.data ?? []) as unknown as {
      id: string
      year: number
      month: number
      title: string | null
      days: number
      garden_month_days: { day: number; body: string }[]
    }[]
    setMonths(
      rows.map((r) => ({
        id: r.id,
        year: r.year,
        month: r.month,
        title: r.title,
        days: r.days,
        texts: Object.fromEntries(r.garden_month_days.map((d) => [d.day, d.body])),
      })),
    )
    setChecks(
      new Set(((c.data ?? []) as { month_id: string; day: number }[]).map((x) => `${x.month_id}:${x.day}`)),
    )
    setLoading(false)
  }, [communityId, profileId])

  useEffect(() => {
    void load()
  }, [load])

  const current = months.find((x) => x.year === today.year && x.month === today.month) ?? null

  async function checkToday() {
    if (!current || !profileId || !communityId) return { error: 'Sem desafio hoje.' }
    setError(null)
    const { error: err } = await supabase.from('garden_checks').insert({
      month_id: current.id,
      profile_id: profileId,
      community_id: communityId,
      day: today.day,
    })
    if (err && !err.message.includes('duplicate')) {
      setError('Não foi possível registrar agora. Tente novamente.')
      return { error: err.message }
    }
    await load()
    return { error: null }
  }

  function checkedDays(monthId: string): Set<number> {
    const out = new Set<number>()
    for (const k of checks) {
      const [id, d] = k.split(':')
      if (id === monthId) out.add(Number(d))
    }
    return out
  }

  /** Mês completo = todos os dias do desafio marcados. */
  function monthDone(m: GardenMonth): boolean {
    return checkedDays(m.id).size >= m.days
  }

  async function saveMonth(input: {
    year: number
    month: number
    title: string
    days: number
    texts: string[]
  }) {
    if (!communityId) return { error: 'Sem comunidade.' }
    const up = await supabase
      .from('garden_months')
      .upsert(
        {
          community_id: communityId,
          year: input.year,
          month: input.month,
          title: input.title.trim() || null,
          days: input.days,
        },
        { onConflict: 'community_id,year,month' },
      )
      .select('id')
      .single()
    if (up.error || !up.data) return { error: up.error?.message ?? 'erro' }
    const monthId = up.data.id as string
    const rows = input.texts
      .slice(0, input.days)
      .map((body, i) => ({ month_id: monthId, day: i + 1, body: body.trim() }))
    const del = await supabase.from('garden_month_days').delete().eq('month_id', monthId)
    if (del.error) return { error: del.error.message }
    const ins = await supabase.from('garden_month_days').insert(rows)
    if (ins.error) return { error: ins.error.message }
    await load()
    return { error: null }
  }

  return {
    today,
    months,
    current,
    loading,
    error,
    checkedDays,
    monthDone,
    checkToday,
    saveMonth,
    reload: load,
  }
}
