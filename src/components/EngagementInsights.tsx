import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useViewTotals } from '../hooks/useViewTotals'
import type { ItemViewKind } from '../lib/itemViews'

// Painel da profissional:
//  - Top 10: as participantes que mais interagem (últimos 30 dias), com os
//    números de cada uma — serve de base para os sorteios mensais;
//  - Visualizações e cliques: revista, e-books, receitas e logos de parceiros.
// Tudo somado no banco (RPC), só para a dona da comunidade.

interface RankingRow {
  profile_id: string
  full_name: string | null
  avatar_url: string | null
  posts: number
  comments: number
  reactions: number
  garden_checks: number
  score: number
}

export function EngagementRanking({ communityId }: { communityId: string }) {
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('community_engagement_ranking', { p_community_id: communityId, p_days: 30 }).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setFailed(true)
        return
      }
      setRows(
        ((data as RankingRow[] | null) ?? []).map((r) => ({
          ...r,
          posts: Number(r.posts),
          comments: Number(r.comments),
          reactions: Number(r.reactions),
          garden_checks: Number(r.garden_checks),
          score: Number(r.score),
        })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [communityId])

  return (
    <section className="rank-card" aria-label="Top 10 de interação">
      <h3 className="rank-card-title">Top 10 · quem mais interage</h3>
      <p className="rank-card-hint">
        Últimos 30 dias. Pontos: publicação 3 · comentário 2 · check no Jardim 2 · curtida 1.
      </p>

      {failed && <p className="auth-error">Não foi possível carregar o ranking agora.</p>}
      {!failed && rows === null && <p className="panel-metrics-muted">Carregando…</p>}
      {!failed && rows && rows.length === 0 && (
        <p className="panel-metrics-muted">Ainda não houve interação nos últimos 30 dias.</p>
      )}

      {rows && rows.length > 0 && (
        <ol className="rank-list">
          {rows.map((r, i) => {
            const name = r.full_name ?? 'Participante'
            return (
              <li key={r.profile_id} className={`rank-item${i < 3 ? ' rank-item--top' : ''}`}>
                <span className="rank-pos">{i + 1}</span>
                <span className="rank-avatar" aria-hidden="true">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" loading="lazy" decoding="async" /> : <span>{name.charAt(0).toUpperCase()}</span>}
                </span>
                <span className="rank-body">
                  <span className="rank-name">{name}</span>
                  <span className="rank-detail">
                    {r.posts} publ. · {r.comments} coment. · {r.reactions} curt. · {r.garden_checks} checks
                  </span>
                </span>
                <span className="rank-score">
                  {r.score}
                  <small>pts</small>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

interface NamedItem {
  id: string
  name: string
}

const GROUPS: { kind: ItemViewKind; title: string; unit: [string, string] }[] = [
  { kind: 'magazine', title: 'Revista', unit: ['visualização', 'visualizações'] },
  { kind: 'ebook', title: 'E-books e produtos da Loja', unit: ['leitura', 'leituras'] },
  { kind: 'partner_click', title: 'Logos de parceiros', unit: ['clique', 'cliques'] },
  { kind: 'travel', title: 'Dicas de Viagem (destinos)', unit: ['visualização', 'visualizações'] },
  { kind: 'series', title: 'Séries e Filmes', unit: ['visualização', 'visualizações'] },
  { kind: 'reading', title: 'Dicas de leitura (livros)', unit: ['visualização', 'visualizações'] },
]

export function ViewsOverview({ communityId }: { communityId: string }) {
  const totals = useViewTotals(communityId)
  const [names, setNames] = useState<Record<string, string>>({})
  const [recipes, setRecipes] = useState<{ id: string; name: string; views: number }[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [mags, prods, parts, recs, recViews, trav, sers, reads] = await Promise.all([
        supabase.from('magazine_issues').select('id,title').eq('community_id', communityId).limit(200),
        supabase.from('products').select('id,title').eq('community_id', communityId).limit(300),
        supabase.from('community_partners').select('id,name').eq('community_id', communityId).limit(100),
        supabase.from('community_content').select('id,title').eq('community_id', communityId).eq('type', 'recipe').limit(500),
        supabase.from('content_views').select('content_id').eq('community_id', communityId).limit(5000),
        supabase.from('travel_places').select('id,title').eq('community_id', communityId).limit(500),
        supabase.from('series_picks').select('id,title').eq('community_id', communityId).limit(500),
        supabase.from('reading_tips').select('id,title').eq('community_id', communityId).limit(500),
      ])
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const r of (mags.data as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      for (const r of (prods.data as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      for (const r of (parts.data as { id: string; name: string }[] | null) ?? []) map[r.id] = r.name
      for (const list of [trav.data, sers.data, reads.data]) {
        for (const r of (list as { id: string; title: string }[] | null) ?? []) map[r.id] = r.title
      }
      setNames(map)

      const counts: Record<string, number> = {}
      for (const row of (recViews.data as { content_id: string }[] | null) ?? []) {
        counts[row.content_id] = (counts[row.content_id] ?? 0) + 1
      }
      setRecipes(
        ((recs.data as { id: string; title: string }[] | null) ?? [])
          .map((r) => ({ id: r.id, name: r.title, views: counts[r.id] ?? 0 }))
          .filter((r) => r.views > 0)
          .sort((a, b) => b.views - a.views),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  const rowsOf = (kind: ItemViewKind): (NamedItem & { views: number; viewers: number })[] =>
    Object.values(totals)
      .filter((t) => t.kind === kind)
      .map((t) => ({ id: t.item_id, name: names[t.item_id] ?? 'Item removido', views: t.views, viewers: t.viewers }))
      .sort((a, b) => b.views - a.views)

  return (
    <div className="panel-metrics-block views-overview">
      <h3 className="panel-metrics-eyebrow">Visualizações e cliques</h3>
      <p className="panel-metrics-hint">
        Quantas vezes cada conteúdo foi aberto pelas participantes (você não entra na conta). A contagem
        começou em 14/11/2026.
      </p>

      {GROUPS.map((g) => {
        const rows = rowsOf(g.kind)
        const total = rows.reduce((n, r) => n + r.views, 0)
        return (
          <div key={g.kind} className="views-group">
            <p className="views-group-title">
              {g.title}
              <span>
                {total} {total === 1 ? g.unit[0] : g.unit[1]}
              </span>
            </p>
            {rows.length === 0 ? (
              <p className="panel-metrics-muted">Nada registrado ainda.</p>
            ) : (
              <ul className="views-list">
                {rows.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <span className="views-name">{r.name}</span>
                    <span className="views-num">
                      {r.views} · {r.viewers} {r.viewers === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <div className="views-group">
        <p className="views-group-title">
          Receitas
          <span>
            {recipes.reduce((n, r) => n + r.views, 0)} pessoas
          </span>
        </p>
        {recipes.length === 0 ? (
          <p className="panel-metrics-muted">Nada registrado ainda.</p>
        ) : (
          <ul className="views-list">
            {recipes.slice(0, 12).map((r) => (
              <li key={r.id}>
                <span className="views-name">{r.name}</span>
                <span className="views-num">
                  {r.views} {r.views === 1 ? 'pessoa abriu' : 'pessoas abriram'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
