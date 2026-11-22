import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCommunityMetrics } from '../hooks/useCommunityMetrics'
import {
  countByDay,
  dayKey,
  isClick,
  lastDays,
  percentChange,
  share,
  sum,
  topItems,
  weeklyGrowth,
} from '../lib/communityInsights'
import type { ViewRow } from '../lib/communityInsights'

// Painel → Métricas: desempenho da comunidade. Crescimento (entradas por
// semana), análise de visualizações e cliques dia a dia (14 dias contra os 14
// anteriores), engajamento e os conteúdos que mais funcionam. Só a dona vê
// (as consultas passam pela RLS); nada aqui identifica quem fez o quê.

const KIND_LABEL: Record<string, string> = {
  magazine: 'Revista',
  ebook: 'E-book / Loja',
  recipe: 'Receita',
  partner_click: 'Parceiro',
}

function Bars({ values, labels, tone }: { values: number[]; labels: string[]; tone: 'views' | 'clicks' | 'growth' }) {
  const max = Math.max(1, ...values)
  return (
    <ol className={`insight-bars insight-bars--${tone}`} aria-label="Gráfico de barras">
      {values.map((v, i) => (
        <li key={i} title={`${labels[i]}: ${v}`}>
          <span className="insight-bar-num">{v > 0 ? v : ''}</span>
          <span className="insight-bar" style={{ height: `${Math.max(v > 0 ? 8 : 2, (v / max) * 100)}%` }} />
          <span className="insight-bar-label">{labels[i]}</span>
        </li>
      ))}
    </ol>
  )
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = percentChange(current, previous)
  if (pct === null) return <span className="insight-delta">sem base para comparar</span>
  const cls = pct > 0 ? 'insight-delta insight-delta--up' : pct < 0 ? 'insight-delta insight-delta--down' : 'insight-delta'
  return (
    <span className={cls}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {Math.abs(pct)}% vs. 14 dias antes
    </span>
  )
}

export function CommunityInsights({ communityId }: { communityId: string }) {
  const { metrics } = useCommunityMetrics(communityId, 30)
  const [rows, setRows] = useState<ViewRow[] | null>(null)
  const [joined, setJoined] = useState<string[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)

  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27).toISOString()
      const [views, members, mags, prods, parts, recs] = await Promise.all([
        supabase
          .from('item_views')
          .select('kind,item_id,profile_id,created_at')
          .eq('community_id', communityId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase.from('community_members').select('joined_at').eq('community_id', communityId).limit(5000),
        supabase.from('magazine_issues').select('id,title').eq('community_id', communityId).limit(200),
        supabase.from('products').select('id,title').eq('community_id', communityId).limit(300),
        supabase.from('community_partners').select('id,name').eq('community_id', communityId).limit(100),
        supabase.from('community_content').select('id,title').eq('community_id', communityId).eq('type', 'recipe').limit(500),
      ])
      if (cancelled) return
      if (views.error || members.error) {
        setFailed(true)
        return
      }
      setRows((views.data as ViewRow[] | null) ?? [])
      setJoined(((members.data as { joined_at: string }[] | null) ?? []).map((m) => m.joined_at))
      const map: Record<string, string> = {}
      for (const r of (mags.data as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      for (const r of (prods.data as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      for (const r of (parts.data as { id: string; name: string }[] | null) ?? []) map[r.id] = r.name
      for (const r of (recs.data as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      setNames(map)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, today])

  const days28 = useMemo(() => lastDays(28, today), [today])
  const days14 = days28.slice(14)
  const labels14 = days14.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`)

  const data = useMemo(() => {
    if (!rows) return null
    const viewsDay = countByDay(rows, days28, (r) => !isClick(r.kind))
    const clicksDay = countByDay(rows, days28, (r) => isClick(r.kind))
    const views = { prev: sum(viewsDay.slice(0, 14)), cur: sum(viewsDay.slice(14)), series: viewsDay.slice(14) }
    const clicks = { prev: sum(clicksDay.slice(0, 14)), cur: sum(clicksDay.slice(14)), series: clicksDay.slice(14) }
    const recent = new Set(days14)
    const recentRows = rows.filter((r) => recent.has(dayKey(new Date(r.created_at))))
    const peakIdx = views.series.indexOf(Math.max(...views.series))
    const viewers = new Set(recentRows.map((r) => r.profile_id)).size
    return { views, clicks, top: topItems(recentRows, 5), peakIdx, viewers, recentCount: recentRows.length }
  }, [rows, days28, days14])

  const growth = useMemo(() => (joined ? weeklyGrowth(joined, 8, today) : null), [joined, today])

  if (failed) {
    return (
      <div className="panel-metrics-block">
        <h3 className="panel-metrics-eyebrow">Desempenho da comunidade</h3>
        <p className="auth-error">Não foi possível carregar o desempenho agora.</p>
      </div>
    )
  }

  const interactions = metrics
    ? metrics.posts_count + metrics.comments_count + metrics.reactions_count + metrics.checkin_responses_count
    : 0
  const activeRate = metrics ? share(metrics.active_members, metrics.total_members) : 0

  return (
    <>
      <div className="panel-metrics-block">
        <h3 className="panel-metrics-eyebrow">Crescimento da comunidade</h3>
        <p className="panel-metrics-hint">Novas participantes por semana nas últimas 8 semanas.</p>
        {!growth ? (
          <p className="panel-metrics-muted">Carregando…</p>
        ) : (
          <>
            <div className="panel-metrics-primary">
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{growth[growth.length - 1].total}</span>
                <span className="panel-metrics-primary-label">Participantes hoje</span>
              </div>
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{growth[growth.length - 1].joined}</span>
                <span className="panel-metrics-primary-label">Entraram esta semana</span>
              </div>
              <div className="panel-metrics-primary-item">
                <span className="panel-metrics-primary-value">{sum(growth.map((w) => w.joined))}</span>
                <span className="panel-metrics-primary-label">Em 8 semanas</span>
              </div>
            </div>
            <Bars values={growth.map((w) => w.joined)} labels={growth.map((w) => w.label)} tone="growth" />
          </>
        )}
      </div>

      <div className="panel-metrics-block">
        <h3 className="panel-metrics-eyebrow">Participação</h3>
        <div className="panel-metrics-grid">
          <div className="panel-metrics-item">
            <span className="panel-metrics-value">{activeRate}%</span>
            <span className="panel-metrics-label">Participantes ativas</span>
          </div>
          <div className="panel-metrics-item">
            <span className="panel-metrics-value">{interactions}</span>
            <span className="panel-metrics-label">Interações em 30 dias</span>
          </div>
          <div className="panel-metrics-item">
            <span className="panel-metrics-value">
              {metrics && metrics.active_members > 0 ? (interactions / metrics.active_members).toFixed(1).replace('.', ',') : '0'}
            </span>
            <span className="panel-metrics-label">Por participante ativa</span>
          </div>
          <div className="panel-metrics-item">
            <span className="panel-metrics-value">{data?.viewers ?? 0}</span>
            <span className="panel-metrics-label">Abriram conteúdos (14 dias)</span>
          </div>
        </div>
      </div>

      <div className="panel-metrics-block">
        <h3 className="panel-metrics-eyebrow">Análise de visualizações e cliques</h3>
        <p className="panel-metrics-hint">Últimos 14 dias, dia a dia. Cliques são os toques nos logos dos parceiros.</p>
        {!data ? (
          <p className="panel-metrics-muted">Carregando…</p>
        ) : (
          <>
            <div className="insight-pair">
              <div className="insight-card">
                <span className="insight-card-title">Visualizações</span>
                <strong className="insight-card-value">{data.views.cur}</strong>
                <Delta current={data.views.cur} previous={data.views.prev} />
                <Bars values={data.views.series} labels={labels14} tone="views" />
              </div>
              <div className="insight-card">
                <span className="insight-card-title">Cliques</span>
                <strong className="insight-card-value">{data.clicks.cur}</strong>
                <Delta current={data.clicks.cur} previous={data.clicks.prev} />
                <Bars values={data.clicks.series} labels={labels14} tone="clicks" />
              </div>
            </div>
            <p className="panel-metrics-hint">
              {data.views.cur > 0
                ? `Dia de pico: ${labels14[data.peakIdx]} (${data.views.series[data.peakIdx]}). `
                : 'Ainda sem visualizações nesse período. '}
              Taxa de cliques sobre as aberturas: {share(data.clicks.cur, data.views.cur + data.clicks.cur)}%.
            </p>
          </>
        )}
      </div>

      <div className="panel-metrics-block">
        <h3 className="panel-metrics-eyebrow">Desempenho dos conteúdos</h3>
        <p className="panel-metrics-hint">Os 5 mais abertos nos últimos 14 dias.</p>
        {!data ? (
          <p className="panel-metrics-muted">Carregando…</p>
        ) : data.top.length === 0 ? (
          <p className="panel-metrics-muted">Nada registrado nesse período.</p>
        ) : (
          <ul className="views-list">
            {data.top.map((t) => (
              <li key={`${t.kind}:${t.item_id}`}>
                <span className="views-name">
                  {names[t.item_id] ?? 'Item removido'} <small>· {KIND_LABEL[t.kind] ?? t.kind}</small>
                </span>
                <span className="views-num">
                  {t.views} · {t.viewers} {t.viewers === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
