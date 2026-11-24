import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LISTING_TYPE_LABEL, claimWhatsAppUrl, groupLabel } from '../lib/city'
import type { CityCategory, CityGroup, CityListingType } from '../lib/city'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { saveCategory, saveGroup, useCityCatalog, useCityGroups, useCityBadge } from '../hooks/useCity'
import { CityGroupsAdmin } from './CityGroupsAdmin'

// Moderação de "Na minha cidade" (administração): denúncias dos cadastros e
// categorias criadas pelas participantes (aprovar, renomear, unir a outra —
// os cadastros migram — ou remover).

interface Report {
  id: string
  listing_id: string
  motivo: string | null
  criada_em: string
  titulo: string
  tipo: CityListingType
  descricao: string | null
  status_cadastro: 'ativo' | 'oculto'
  cidade: string
  estado: string
  autora_nome: string | null
  denunciante_nome: string | null
}

interface PendingCategory {
  id: string
  nome: string
  grupo: string
  grupo_sugerido?: string | null
  criada_em: string
  criada_por_nome: string | null
  usos: number
}

function ReportsList() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('city_admin_reports')
    if (rpcError) setError('Não foi possível carregar as denúncias.')
    else {
      setError(null)
      setReports((data ?? []) as Report[])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('city_admin_reports').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError('Não foi possível carregar as denúncias.')
      else setReports((data ?? []) as Report[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function resolve(id: string, action: 'ocultar' | 'excluir' | 'ignorar') {
    if (action === 'excluir' && !window.confirm('Excluir este cadastro de vez? Não dá para desfazer.')) return
    setBusyId(id)
    const { error: rpcError } = await supabase.rpc('city_report_resolve', { p_report: id, p_action: action })
    setBusyId(null)
    if (rpcError) setError('Não foi possível concluir agora.')
    else await load()
  }

  return (
    <div className="cty-admin">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!reports && !error && <p className="home-muted">Carregando…</p>}
      {reports && reports.length === 0 && <p className="home-muted">Nenhuma denúncia aberta. Tudo em ordem.</p>}
      {reports?.map((r) => (
        <article key={r.id} className="cty-admin-item">
          <p>
            <strong>{r.titulo}</strong> · {LISTING_TYPE_LABEL[r.tipo]} · {r.cidade}/{r.estado}
            {r.status_cadastro === 'oculto' ? ' · oculto' : ''}
          </p>
          <p className="home-muted">
            Criado por {r.autora_nome ?? 'Participante'} · denunciado por {r.denunciante_nome ?? 'Participante'} {formatRelativeTime(r.criada_em)}
          </p>
          {r.descricao && <p>{r.descricao}</p>}
          <p>Motivo: {r.motivo ?? 'não informado'}</p>
          <div className="cty-actions">
            <button type="button" className="cty-btn cty-btn--small" disabled={busyId === r.id} onClick={() => void resolve(r.id, 'ocultar')}>
              Ocultar cadastro
            </button>
            <button type="button" className="cty-btn cty-btn--small" disabled={busyId === r.id} onClick={() => void resolve(r.id, 'ignorar')}>
              Manter (ignorar denúncia)
            </button>
            <button type="button" className="cty-btn cty-btn--small" disabled={busyId === r.id} onClick={() => void resolve(r.id, 'excluir')}>
              Excluir cadastro
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

interface Claim {
  id: string
  listing_id: string
  titulo: string
  tipo: CityListingType
  cidade: string
  estado: string
  nome: string
  whatsapp: string
  mensagem: string | null
  status: 'pendente' | 'aprovada'
  criado_em: string
  destaque: 'pending' | 'active' | 'past_due' | null
}

function ClaimItem({ k, busy, onResolve }: { k: Claim; busy: boolean; onResolve: (id: string, action: 'aprovar' | 'recusar' | 'revogar') => void }) {
  const wa = claimWhatsAppUrl(k.whatsapp)
  return (
    <article className="cty-admin-item">
      <p>
        <strong>{k.titulo}</strong> · {LISTING_TYPE_LABEL[k.tipo]} · {k.cidade}/{k.estado}
      </p>
      <p className="home-muted">
        Pedido de {k.nome} {formatRelativeTime(k.criado_em)} · {k.status === 'pendente' ? 'aguardando aprovação' : 'aprovado'}
        {k.destaque ? ' · destaque ' + (k.destaque === 'active' ? 'ativo' : k.destaque === 'pending' ? 'aguardando pagamento' : 'com pagamento em aberto') : ''}
      </p>
      {k.mensagem && <p>Recado: {k.mensagem}</p>}
      <div className="cty-actions">
        {wa && (
          <a className="cty-btn cty-btn--small" href={wa} target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        )}
        {k.status === 'pendente' ? (
          <>
            <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy} onClick={() => onResolve(k.id, 'aprovar')}>
              Aprovar
            </button>
            <button type="button" className="cty-btn cty-btn--small" disabled={busy} onClick={() => onResolve(k.id, 'recusar')}>
              Recusar
            </button>
          </>
        ) : (
          <button type="button" className="cty-btn cty-btn--small" disabled={busy} onClick={() => onResolve(k.id, 'revogar')}>
            Tirar a dona
          </button>
        )}
      </div>
    </article>
  )
}

/** Pedidos de reivindicação: a nutricionista fala com a pessoa pelo WhatsApp e aprova ou recusa. */
export function ClaimsList() {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('city_admin_claims')
    if (rpcError) setError('Não foi possível carregar os pedidos.')
    else {
      setError(null)
      setClaims((data ?? []) as Claim[])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('city_admin_claims').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError('Não foi possível carregar os pedidos.')
      else setClaims((data ?? []) as Claim[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function resolve(id: string, action: 'aprovar' | 'recusar' | 'revogar') {
    if (action !== 'aprovar' && !window.confirm(action === 'revogar' ? 'Tirar a dona deste negócio?' : 'Recusar este pedido?')) return
    setBusyId(id)
    const { error: rpcError } = await supabase.rpc('city_claim_resolve', { p_claim: id, p_action: action })
    setBusyId(null)
    if (rpcError) setError('Não foi possível concluir agora.')
    else await load()
  }

  const pending = (claims ?? []).filter((k) => k.status === 'pendente')
  const approved = (claims ?? []).filter((k) => k.status === 'aprovada')

  return (
    <div className="cty-admin">
      <p className="home-muted">A pessoa deixou o WhatsApp no pedido: toque em “Falar no WhatsApp”, confirme que o negócio é dela e aprove. Depois de aprovado, ela pode contratar o destaque (R$ 4,90 por mês).</p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!claims && !error && <p className="home-muted">Carregando…</p>}
      {claims && pending.length === 0 && <p className="home-muted">Nenhum pedido pendente.</p>}
      {pending.map((k) => (
        <ClaimItem key={k.id} k={k} busy={busyId === k.id} onResolve={resolve} />
      ))}
      {approved.length > 0 && (
        <>
          <h4 className="cty-admin-sub">Negócios com dona</h4>
          {approved.map((k) => (
            <ClaimItem key={k.id} k={k} busy={busyId === k.id} onResolve={resolve} />
          ))}
        </>
      )}
    </div>
  )
}

function CategoryItem({ cat, others, groups, onDone }: { cat: PendingCategory; others: CityCategory[]; groups: CityGroup[]; onDone: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(cat.nome)
  const [merging, setMerging] = useState(false)
  const [into, setInto] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function criarGrupoSugerido() {
    if (!cat.grupo_sugerido) return
    setBusy(true)
    setError(null)
    const g = await saveGroup({ nome: cat.grupo_sugerido })
    if (g.error || !g.slug) {
      setBusy(false)
      setError(g.error ?? 'Não foi possível criar o grupo.')
      return
    }
    const r = await saveCategory({ id: cat.id, nome: cat.nome, grupo: g.slug })
    setBusy(false)
    if (r.error) setError(r.error)
    else onDone()
  }

  async function run(action: string, value?: string, target?: string) {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('city_category_admin', {
      p_id: cat.id,
      p_action: action,
      p_value: value ?? null,
      p_into: target ?? null,
    })
    setBusy(false)
    if (rpcError) setError('Não foi possível concluir agora.')
    else onDone()
  }

  return (
    <article className="cty-admin-item">
      <p>
        <strong>{cat.nome}</strong> · {groupLabel(cat.grupo, groups)}
      </p>
      {cat.grupo_sugerido && (
        <p className="cty-note">
          Ela pediu também um <strong>grupo novo</strong>: “{cat.grupo_sugerido}”.{' '}
          <button
            type="button"
            className="cty-link"
            disabled={busy}
            onClick={() => void criarGrupoSugerido()}
          >
            Criar o grupo e mover a categoria
          </button>
        </p>
      )}
      <p className="home-muted">
        Criada por {cat.criada_por_nome ?? 'Participante'} {formatRelativeTime(cat.criada_em)} · {cat.usos} {cat.usos === 1 ? 'cadastro' : 'cadastros'}
      </p>
      {renaming && (
        <div className="cty-row">
          <label className="cty-field">
            <span className="cty-label">Novo nome</span>
            <input type="text" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" className="cty-btn cty-btn--primary" disabled={busy || name.trim().length < 2} onClick={() => void run('renomear', name.trim())}>
            Salvar nome
          </button>
        </div>
      )}
      {merging && (
        <div className="cty-row">
          <label className="cty-field">
            <span className="cty-label">Unir a qual categoria? (os cadastros migram)</span>
            <select value={into} onChange={(e) => setInto(e.target.value)}>
              <option value="">Escolha</option>
              {groups.map((g) => (
                <optgroup key={g.slug} label={g.nome}>
                  {others.filter((c) => c.grupo === g.slug).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" className="cty-btn cty-btn--primary" disabled={busy || !into} onClick={() => void run('unir', undefined, into)}>
            Unir
          </button>
        </div>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="cty-actions">
        <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy} onClick={() => void run('aprovar')}>
          Aprovar
        </button>
        <button type="button" className="cty-btn cty-btn--small" disabled={busy} onClick={() => { setRenaming((v) => !v); setMerging(false) }}>
          Renomear
        </button>
        <button type="button" className="cty-btn cty-btn--small" disabled={busy} onClick={() => { setMerging((v) => !v); setRenaming(false) }}>
          Unir a outra
        </button>
        <button
          type="button"
          className="cty-btn cty-btn--small"
          disabled={busy}
          onClick={() => {
            if (window.confirm('Remover esta categoria? Os cadastros dela vão para "Outros".')) void run('remover')
          }}
        >
          Remover
        </button>
      </div>
    </article>
  )
}

function CategoriesList() {
  const [items, setItems] = useState<PendingCategory[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { categories, reload: reloadCatalog } = useCityCatalog()
  const { groups } = useCityGroups()

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('city_admin_categories')
    if (rpcError) setError('Não foi possível carregar as categorias.')
    else {
      setError(null)
      setItems((data ?? []) as PendingCategory[])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('city_admin_categories').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError('Não foi possível carregar as categorias.')
      else setItems((data ?? []) as PendingCategory[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="cty-admin">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="home-muted">Carregando…</p>}
      {items && items.length === 0 && <p className="home-muted">Nenhuma categoria nova para revisar.</p>}
      {items?.map((c) => (
        <CategoryItem
          key={c.id}
          cat={c}
          others={categories.filter((k) => k.id !== c.id && k.status !== 'unida')}
          groups={groups}
          onDone={() => {
            void load()
            void reloadCatalog()
          }}
        />
      ))}
    </div>
  )
}

function TabDot({ n }: { n: number }) {
  return n > 0 ? <span className="notif-dot notif-dot--mini cty-tab-dot" aria-label={`${n} novo(s)`} /> : null
}

export function CityAdminPanel({ uid = null }: { uid?: string | null }) {
  const [tab, setTab] = useState<'denuncias' | 'reivindicacoes' | 'categorias' | 'grupos'>('reivindicacoes')
  const { admin } = useCityBadge(uid ?? 'admin', true, true)
  const tabs: { key: typeof tab; label: string; n: number }[] = [
    { key: 'reivindicacoes', label: 'Reivindicações', n: admin.claims },
    { key: 'categorias', label: 'Pedidos de categoria', n: admin.categorias },
    { key: 'grupos', label: 'Grupos e categorias', n: 0 },
    { key: 'denuncias', label: 'Denúncias', n: admin.denuncias },
  ]
  return (
    <section className="cty-admin" aria-label="Moderação de Na minha cidade">
      <h3 className="cty-form-title">Na minha cidade</h3>
      <div className="cty-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cty-tab${tab === t.key ? ' cty-tab--on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            <TabDot n={t.n} />
          </button>
        ))}
      </div>
      {tab === 'denuncias' ? <ReportsList /> : tab === 'reivindicacoes' ? <ClaimsList /> : tab === 'categorias' ? <CategoriesList /> : <CityGroupsAdmin />}
    </section>
  )
}
