import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Recipe } from '../../hooks/useRecipes'
import type { useShopping } from '../../hooks/useShopping'
import { CATEGORIES, UNITS, groupByCategory, guessCategory, parsePriceToCents, totalsOf } from '../../lib/shopping'
import type { CategoryKey, ShoppingList, UnitKey } from '../../lib/shopping'
import { formatBrl } from '../../lib/plansCatalog'
import { ItemRow } from './ItemRow'
import { RecipeToList } from './RecipeToList'
import { ShareDialog } from './ShareDialog'
import { SupermarketMode } from './SupermarketMode'

// Uma lista de compras: dados da lista, produtos por categoria, totais,
// duplicar, compartilhar, concluir, arquivar e excluir.

type Api = ReturnType<typeof useShopping>

const brDate = (iso: string | null): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export function ListView({
  list,
  profileId,
  recipes,
  api,
  onBack,
  onOpenList,
}: {
  list: ShoppingList
  profileId: string
  recipes: Recipe[]
  api: Api
  onBack: () => void
  onOpenList: (id: string) => void
}) {
  const items = useMemo(() => api.items[list.id] ?? [], [api.items, list.id])
  const isOwner = list.owner_id === profileId
  const [canEdit, setCanEdit] = useState(isOwner)
  const [editing, setEditing] = useState(false)
  const [meta, setMeta] = useState({ name: list.name, description: list.description ?? '', planned_for: list.planned_for ?? '', notes: list.notes ?? '' })
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState<UnitKey>('un')
  const [cat, setCat] = useState<CategoryKey | ''>('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [market, setMarket] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [fromRecipes, setFromRecipes] = useState(false)

  // quem recebeu a lista só edita se a dona deixou
  useEffect(() => {
    if (isOwner) return
    let cancelled = false
    void api.loadShares(list.id).then((s) => {
      if (!cancelled) setCanEdit(s.some((x) => x.profile_id === profileId && x.permission === 'edit'))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id, isOwner, profileId])

  // sugestões a partir de tudo o que a usuária já comprou
  const suggestions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const arr of Object.values(api.items)) {
      for (const i of arr) {
        const k = i.name.trim().toLowerCase()
        if (!seen.has(k)) {
          seen.add(k)
          out.push(i.name.trim())
        }
      }
    }
    return out.slice(0, 300)
  }, [api.items])

  const t = totalsOf(items)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const q = Number(qty.replace(',', '.'))
    setError(null)
    const r = await api.addItem(list.id, {
      name: n,
      category: cat || guessCategory(n),
      quantity: Number.isFinite(q) && q >= 0 ? q : 1,
      unit,
      notes: null,
      est_price_cents: parsePriceToCents(price),
    })
    if (r.error) setError(r.error)
    else {
      setName('')
      setQty('1')
      setPrice('')
      setCat('')
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault()
    if (!meta.name.trim()) {
      setError('Dê um nome à lista.')
      return
    }
    const r = await api.updateList(list.id, {
      name: meta.name.trim(),
      description: meta.description.trim() || null,
      planned_for: meta.planned_for || null,
      notes: meta.notes.trim() || null,
    })
    if (r.error) setError(r.error)
    else {
      setEditing(false)
      setError(null)
    }
  }

  async function setStatus(status: ShoppingList['status']) {
    const r = await api.updateList(list.id, { status })
    if (r.error) setError(r.error)
    else if (status !== 'em_andamento') onBack()
  }

  return (
    <section className="ml-detail">
      <button type="button" className="auth-link" onClick={onBack}>
        ‹ Minha Lista
      </button>

      {editing ? (
        <form className="ml-form" onSubmit={(e) => void saveMeta(e)}>
          <label className="ml-field">
            Nome
            <input value={meta.name} maxLength={120} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
          </label>
          <label className="ml-field">
            Descrição
            <input value={meta.description} maxLength={600} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          </label>
          <label className="ml-field">
            Data prevista para as compras
            <input type="date" value={meta.planned_for} onChange={(e) => setMeta({ ...meta, planned_for: e.target.value })} />
          </label>
          <label className="ml-field">
            Observações
            <textarea rows={3} value={meta.notes} maxLength={2000} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
          </label>
          <div className="ml-actions">
            <button type="button" className="auth-link" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button type="submit" className="water-primary">
              Salvar
            </button>
          </div>
        </form>
      ) : (
        <header className="ml-detail-head">
          <h2>{list.name}</h2>
          {list.description && <p>{list.description}</p>}
          <p className="home-muted">
            Criada em {brDate(list.created_at)} · compras previstas: {brDate(list.planned_for)}
            {list.status !== 'em_andamento' ? ` · ${list.status === 'concluida' ? 'concluída' : 'arquivada'}` : ''}
            {!isOwner ? ' · compartilhada com você' : ''}
          </p>
          {list.notes && <p className="ml-notes">{list.notes}</p>}
        </header>
      )}

      <div className="ml-totals" aria-label="Resumo da lista">
        <div>
          <strong>
            {t.bought}/{t.total}
          </strong>
          <span>comprados</span>
        </div>
        <div>
          <strong>{t.pending}</strong>
          <span>faltam</span>
        </div>
        <div>
          <strong>{formatBrl(t.estimatedCents)}</strong>
          <span>estimado</span>
        </div>
        <div>
          <strong>{formatBrl(t.spentCents)}</strong>
          <span>gasto</span>
        </div>
        <div className={t.differenceCents > 0 ? 'ml-over' : t.differenceCents < 0 ? 'ml-under' : ''}>
          <strong>
            {t.differenceCents > 0 ? '+' : ''}
            {formatBrl(t.differenceCents)}
          </strong>
          <span>diferença</span>
        </div>
      </div>
      <div className="ml-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.progress * 100)}>
        <span style={{ width: `${Math.round(t.progress * 100)}%` }} />
      </div>

      <div className="ml-actions ml-actions--start">
        <button type="button" className="water-primary" onClick={() => setMarket(true)}>
          Modo supermercado
        </button>
        {canEdit && (
          <button type="button" className="auth-link" onClick={() => setFromRecipes(true)}>
            + Ingredientes de receitas
          </button>
        )}
        {isOwner && (
          <button type="button" className="auth-link" onClick={() => setSharing(true)}>
            Compartilhar
          </button>
        )}
        {isOwner && (
          <button type="button" className="auth-link" onClick={() => setEditing(true)}>
            Editar dados
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            className="auth-link"
            onClick={async () => {
              const r = await api.duplicateList(list)
              if (r.error || !r.id) setError(r.error ?? 'Não foi possível duplicar.')
              else {
                setMsg('Lista duplicada.')
                onOpenList(r.id)
              }
            }}
          >
            Duplicar
          </button>
        )}
      </div>

      {canEdit && (
        <form className="ml-add" onSubmit={(e) => void add(e)}>
          <input
            list="ml-suggestions"
            value={name}
            placeholder="Adicionar produto"
            aria-label="Produto"
            maxLength={160}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
          <datalist id="ml-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input inputMode="decimal" className="ml-qty" aria-label="Quantidade do novo produto" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select aria-label="Unidade do novo produto" value={unit} onChange={(e) => setUnit(e.target.value as UnitKey)}>
            {UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
          <select aria-label="Categoria do novo produto" value={cat || (name.trim() ? guessCategory(name) : 'outros')} onChange={(e) => setCat(e.target.value as CategoryKey)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input inputMode="decimal" aria-label="Preço estimado do novo produto" placeholder="R$ estimado" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button type="submit" className="water-primary" disabled={!name.trim()}>
            Adicionar
          </button>
        </form>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {msg && (
        <p className="auth-success" role="status">
          {msg}
        </p>
      )}

      {items.length === 0 && <p className="home-muted">A lista está vazia. Adicione produtos acima ou traga ingredientes das receitas.</p>}
      {groupByCategory(items).map((g) => (
        <section key={g.key} className="ml-cat">
          <h4>
            {g.label} <small>({g.items.length})</small>
          </h4>
          <ul className="ml-items">
            {g.items.map((i) => (
              <ItemRow key={i.id} item={i} canEdit={canEdit} onChange={(p) => void api.updateItem(i, p)} onRemove={() => void api.removeItem(i)} />
            ))}
          </ul>
        </section>
      ))}

      {isOwner && (
        <div className="ml-actions ml-actions--start">
          {list.status === 'em_andamento' ? (
            <button type="button" className="water-primary" onClick={() => void setStatus('concluida')}>
              Concluir compras
            </button>
          ) : (
            <button type="button" className="auth-link" onClick={() => void setStatus('em_andamento')}>
              Reabrir lista
            </button>
          )}
          {list.status !== 'arquivada' && (
            <button type="button" className="auth-link" onClick={() => void setStatus('arquivada')}>
              Arquivar
            </button>
          )}
          <button
            type="button"
            className="agenda-danger"
            onClick={async () => {
              if (!window.confirm(`Excluir a lista "${list.name}" e todos os produtos? Não dá para desfazer.`)) return
              const r = await api.deleteList(list.id)
              if (r.error) setError(r.error)
              else onBack()
            }}
          >
            Excluir
          </button>
        </div>
      )}

      {market && <SupermarketMode list={list} items={items} canEdit={canEdit} api={api} onClose={() => setMarket(false)} />}
      {sharing && <ShareDialog list={list} items={items} api={api} onClose={() => setSharing(false)} />}
      {fromRecipes && (
        <RecipeToList
          recipes={recipes}
          api={api}
          defaultTarget={list.id}
          onClose={() => setFromRecipes(false)}
          onDone={() => {
            setFromRecipes(false)
            setMsg('Ingredientes adicionados.')
          }}
        />
      )}
    </section>
  )
}
