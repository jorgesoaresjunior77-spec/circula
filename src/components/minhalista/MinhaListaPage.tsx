import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useRecipes } from '../../hooks/useRecipes'
import { useShopping } from '../../hooks/useShopping'
import { totalsOf } from '../../lib/shopping'
import type { ShoppingList } from '../../lib/shopping'
import { formatBrl } from '../../lib/plansCatalog'
import { ListView } from './ListView'
import { MinhaListaCommercial } from './MinhaListaCommercial'
import { RecipeToList } from './RecipeToList'
import { NewListDialog } from './NewListDialog'

// Minha Lista: painel com as listas, criar lista, montar com receitas e
// histórico. Quem não tem o serviço vê a página comercial. Quem já criou
// listas e deixou de assinar continua vendo o que tem (só não cria novas).

type View = { name: 'home' } | { name: 'history' } | { name: 'new' } | { name: 'list'; id: string }

const brDate = (iso: string | null): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

function ListCard({ list, api, mine, onOpen }: { list: ShoppingList; api: ReturnType<typeof useShopping>; mine: boolean; onOpen: () => void }) {
  const t = totalsOf(api.items[list.id] ?? [])
  return (
    <button type="button" className="ml-card" onClick={onOpen}>
      <span className="ml-card-top">
        <strong>{list.name}</strong>
        {!mine && <em className="ml-chip">compartilhada</em>}
      </span>
      <span className="ml-card-meta">
        {t.bought}/{t.total} comprados · {t.pending} faltam
        {list.planned_for ? ` · compras em ${brDate(list.planned_for)}` : ''}
      </span>
      <span className="ml-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(t.progress * 100)}%` }} />
      </span>
      <span className="ml-card-meta">Estimado {formatBrl(t.estimatedCents)}</span>
    </button>
  )
}

export function MinhaListaPage({
  communityId,
  profileId,
  firstName,
  canUse,
  onOpenPlans,
}: {
  communityId: string
  profileId: string
  firstName: string
  /** Tem o plano (ou o Premium) ou é a dona da comunidade. */
  canUse: boolean
  onOpenPlans: () => void
}) {
  const api = useShopping(communityId, profileId)
  const recipesApi = useRecipes(communityId, profileId, false)
  const [view, setView] = useState<View>({ name: 'home' })
  const [fromRecipes, setFromRecipes] = useState(false)
  const [newDialog, setNewDialog] = useState(false)
  const [lockMsg, setLockMsg] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', planned_for: '' })
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => api.lists.filter((l) => l.status === 'em_andamento'), [api.lists])
  const history = useMemo(() => api.lists.filter((l) => l.status !== 'em_andamento'), [api.lists])
  const agg = useMemo(() => {
    let pending = 0
    let bought = 0
    let estimated = 0
    for (const l of active) {
      const t = totalsOf(api.items[l.id] ?? [])
      pending += t.pending
      bought += t.bought
      estimated += t.estimatedCents
    }
    return { pending, bought, estimated }
  }, [active, api.items])

  if (api.loading) return <p className="home-muted">Carregando suas listas…</p>
  // Sem o serviço e sem nada criado: página comercial. Quem já tem listas vê o que criou.
  if (!canUse && api.lists.length === 0) return <MinhaListaCommercial onOpenPlans={onOpenPlans} />

  if (view.name === 'list') {
    const list = api.lists.find((l) => l.id === view.id)
    if (!list) return <p className="home-muted">Lista não encontrada.</p>
    return (
      <ListView
        key={list.id}
        list={list}
        profileId={profileId}
        recipes={recipesApi.recipes}
        api={api}
        onBack={() => setView({ name: 'home' })}
        onOpenList={(id) => setView({ name: 'list', id })}
      />
    )
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Dê um nome à lista.')
      return
    }
    const r = await api.createList({ name: form.name, description: form.description, planned_for: form.planned_for })
    if (r.error || !r.id) {
      setError(r.error ?? 'Não foi possível criar a lista.')
      return
    }
    setForm({ name: '', description: '', planned_for: '' })
    setError(null)
    setView({ name: 'list', id: r.id })
  }

  if (view.name === 'new') {
    return (
      <section className="ml-page">
        <button type="button" className="auth-link" onClick={() => setView({ name: 'home' })}>
          ‹ Minha Lista
        </button>
        <h2>Nova lista</h2>
        <form className="ml-form" onSubmit={(e) => void create(e)}>
          <label className="ml-field">
            Nome
            <input value={form.name} maxLength={120} placeholder="ex.: Compras da semana" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="ml-field">
            Descrição (opcional)
            <input value={form.description} maxLength={600} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="ml-field">
            Data prevista para as compras (opcional)
            <input type="date" value={form.planned_for} onChange={(e) => setForm({ ...form, planned_for: e.target.value })} />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="water-primary">
            Criar lista
          </button>
        </form>
      </section>
    )
  }

  if (view.name === 'history') {
    return (
      <section className="ml-page">
        <button type="button" className="auth-link" onClick={() => setView({ name: 'home' })}>
          ‹ Minha Lista
        </button>
        <h2>Histórico de compras</h2>
        {history.length === 0 && <p className="home-muted">Quando você concluir ou arquivar uma lista, ela aparece aqui.</p>}
        <ul className="ml-history">
          {history.map((l) => {
            const items = api.items[l.id] ?? []
            const t = totalsOf(items)
            return (
              <li key={l.id} className="ml-history-item">
                <button type="button" className="ml-link" onClick={() => setView({ name: 'list', id: l.id })}>
                  <strong>{l.name}</strong>
                </button>
                <span className="home-muted">
                  {l.status === 'concluida' ? `concluída em ${brDate(l.completed_at)}` : 'arquivada'} · {t.total} produtos · gasto {formatBrl(t.spentCents)}
                </span>
                {l.owner_id === profileId && canUse && (
                  <button
                    type="button"
                    className="auth-link"
                    onClick={async () => {
                      const r = await api.duplicateList(l)
                      if (r.id) setView({ name: 'list', id: r.id })
                    }}
                  >
                    Duplicar para comprar de novo
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section className="ml-page">
      <header className="ml-hero">
        <h2>Olá, {firstName}!</h2>
        <p>Organize suas compras, planeje sua alimentação e tenha tudo o que precisa sempre à mão.</p>
      </header>

      {!canUse && (
        <div className="ml-lock">
          <p>
            Seu acesso à Minha Lista não está ativo. Você continua vendo as listas que já criou, mas para criar novas é preciso assinar.
          </p>
          <button type="button" className="water-primary" onClick={onOpenPlans}>
            Ver planos
          </button>
        </div>
      )}

      <div className="ml-stats">
        <div>
          <strong>{active.length}</strong>
          <span>listas em andamento</span>
        </div>
        <div>
          <strong>{agg.pending}</strong>
          <span>produtos pendentes</span>
        </div>
        <div>
          <strong>{agg.bought}</strong>
          <span>produtos comprados</span>
        </div>
        <div>
          <strong>{formatBrl(agg.estimated)}</strong>
          <span>valor estimado</span>
        </div>
      </div>

      <div className="ml-actions ml-actions--start">
        <button type="button" className="water-primary" onClick={() => (canUse ? setNewDialog(true) : setLockMsg(true))}>
          Criar nova lista
        </button>
        <button type="button" className="water-primary" onClick={() => (canUse ? setFromRecipes(true) : setLockMsg(true))}>
          Montar lista com receitas
        </button>
        <button type="button" className="auth-link" onClick={() => setView({ name: 'history' })}>
          Ver histórico
        </button>
      </div>

      {lockMsg && !canUse && (
        <p className="auth-error" role="alert">
          Para criar listas, ative a Minha Lista em Planos e assinaturas.
        </p>
      )}
      {api.error && (
        <p className="auth-error" role="alert">
          {api.error}
        </p>
      )}
      <h3>Listas em andamento</h3>
      {active.length === 0 ? (
        <p className="home-muted">Nenhuma lista em andamento. Que tal criar a primeira?</p>
      ) : (
        <div className="ml-grid">
          {active.map((l) => (
            <ListCard key={l.id} list={l} api={api} mine={l.owner_id === profileId} onOpen={() => setView({ name: 'list', id: l.id })} />
          ))}
        </div>
      )}

      {newDialog && (
        <NewListDialog
          api={api}
          onClose={() => setNewDialog(false)}
          onCreated={(id) => {
            setNewDialog(false)
            setView({ name: 'list', id })
          }}
        />
      )}

      {fromRecipes && (
        <RecipeToList
          recipes={recipesApi.recipes}
          api={api}
          onClose={() => setFromRecipes(false)}
          onDone={(id) => {
            setFromRecipes(false)
            setView({ name: 'list', id })
          }}
        />
      )}
    </section>
  )
}
