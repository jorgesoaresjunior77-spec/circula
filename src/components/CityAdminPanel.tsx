import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CITY_GROUPS, LISTING_TYPE_LABEL, groupLabel } from '../lib/city'
import type { CityCategory, CityListingType } from '../lib/city'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { useCityCatalog } from '../hooks/useCity'

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

function CategoryItem({ cat, others, onDone }: { cat: PendingCategory; others: CityCategory[]; onDone: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(cat.nome)
  const [merging, setMerging] = useState(false)
  const [into, setInto] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <strong>{cat.nome}</strong> · {groupLabel(cat.grupo)}
      </p>
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
              {CITY_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {others.filter((c) => c.grupo === g.key).map((c) => (
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
          onDone={() => {
            void load()
            void reloadCatalog()
          }}
        />
      ))}
    </div>
  )
}

export function CityAdminPanel() {
  const [tab, setTab] = useState<'denuncias' | 'categorias'>('denuncias')
  return (
    <section className="cty-admin" aria-label="Moderação de Na minha cidade">
      <h3 className="cty-form-title">Na minha cidade · moderação</h3>
      <div className="cty-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'denuncias'} className={`cty-tab${tab === 'denuncias' ? ' cty-tab--on' : ''}`} onClick={() => setTab('denuncias')}>
          Denúncias
        </button>
        <button type="button" role="tab" aria-selected={tab === 'categorias'} className={`cty-tab${tab === 'categorias' ? ' cty-tab--on' : ''}`} onClick={() => setTab('categorias')}>
          Categorias criadas por membros
        </button>
      </div>
      {tab === 'denuncias' ? <ReportsList /> : <CategoriesList />}
    </section>
  )
}
