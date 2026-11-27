import { useEffect, useState } from 'react'
import type { useShopping } from '../../hooks/useShopping'
import { centsToInput, groupByCategory, guessCategory, parsePriceToCents, totalsOf, formatQty } from '../../lib/shopping'
import type { ListItem, ShoppingList } from '../../lib/shopping'
import { formatBrl } from '../../lib/plansCatalog'

// Modo supermercado: tela cheia pensada para o celular. Toque grande para
// marcar, ajuste de quantidade, marca, valor estimado x valor PAGO (o pago só
// se registra aqui, na hora da compra), o que ainda falta e o total. Tudo
// salva na hora. No fim, "Finalizar compra" guarda mercado, data e preços no
// histórico, que alimenta os gráficos de preço.

type Api = ReturnType<typeof useShopping>

function Row({ item, canEdit, api }: { item: ListItem; canEdit: boolean; api: Api }) {
  const [paid, setPaid] = useState(centsToInput(item.paid_price_cents))
  const [brand, setBrand] = useState(item.brand ?? '')
  useEffect(() => setPaid(centsToInput(item.paid_price_cents)), [item.paid_price_cents])
  useEffect(() => setBrand(item.brand ?? ''), [item.brand])
  const step = item.unit === 'g' || item.unit === 'ml' ? 100 : item.unit === 'kg' || item.unit === 'l' ? 0.5 : 1
  const bump = (d: number) => void api.updateItem(item, { quantity: Math.max(0, Math.round((item.quantity + d * step) * 1000) / 1000) })
  return (
    <li className={`sm-item${item.bought ? ' sm-item--done' : ''}`}>
      <button
        type="button"
        className="sm-check"
        aria-pressed={item.bought}
        aria-label={`${item.bought ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        disabled={!canEdit}
        onClick={() => void api.updateItem(item, { bought: !item.bought })}
      >
        {item.bought ? '✓' : ''}
      </button>
      <div className="sm-body">
        <strong>{item.name}</strong>
        <span className="sm-qty">
          {canEdit && (
            <button type="button" aria-label={`Menos ${item.name}`} onClick={() => bump(-1)}>
              −
            </button>
          )}
          <span>{formatQty(item.quantity, item.unit)}</span>
          {canEdit && (
            <button type="button" aria-label={`Mais ${item.name}`} onClick={() => bump(1)}>
              +
            </button>
          )}
        </span>
        <input
          className="sm-brand"
          aria-label={`Marca de ${item.name}`}
          placeholder="Marca (opcional)"
          maxLength={80}
          value={brand}
          disabled={!canEdit}
          onChange={(e) => setBrand(e.target.value)}
          onBlur={() => {
            const b = brand.trim() || null
            if (b !== (item.brand ?? null)) void api.updateItem(item, { brand: b })
          }}
        />
      </div>
      <div className="sm-prices">
        <span className="sm-est">
          Estimado <strong>{item.est_price_cents != null ? formatBrl(item.est_price_cents) : '—'}</strong>
        </span>
        <label className="sm-price">
          <span>Pago R$</span>
          <input
            inputMode="decimal"
            aria-label={`Preço pago de ${item.name}`}
            placeholder={item.est_price_cents != null ? centsToInput(item.est_price_cents) : '0,00'}
            value={paid}
            disabled={!canEdit}
            onChange={(e) => setPaid(e.target.value)}
            onBlur={() => {
              const c = parsePriceToCents(paid)
              if (c !== item.paid_price_cents) void api.updateItem(item, { paid_price_cents: c })
            }}
          />
        </label>
      </div>
    </li>
  )
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function FinishPurchase({ list, items, api, onDone, onCancel }: { list: ShoppingList; items: ListItem[]; api: Api; onDone: () => void; onCancel: () => void }) {
  const [store, setStore] = useState(list.store_name ?? '')
  const [date, setDate] = useState(list.purchased_on ?? todayIso())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bought = items.filter((i) => i.bought)
  const noPrice = bought.filter((i) => i.paid_price_cents == null).length
  const t = totalsOf(items)

  async function save() {
    if (!store.trim()) {
      setError('Informe o nome do supermercado.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await api.savePurchase(list.id, store, date)
    setBusy(false)
    if (r.error) {
      setError(r.error)
      return
    }
    onDone()
  }

  return (
    <div className="sm-finish" role="dialog" aria-modal="true" aria-label="Finalizar compra">
      <div className="sm-finish-card">
        <h3>Finalizar compra</h3>
        <p className="home-muted">
          {bought.length} {bought.length === 1 ? 'produto comprado' : 'produtos comprados'} · total pago <strong>{formatBrl(t.spentCents)}</strong>
        </p>
        {noPrice > 0 && (
          <p className="sm-finish-warn">
            {noPrice === 1 ? '1 produto está' : `${noPrice} produtos estão`} sem o valor pago: {noPrice === 1 ? 'ele entra' : 'eles entram'} no histórico, mas fora dos gráficos de preço.
          </p>
        )}
        <label className="ml-field">
          Supermercado
          <input value={store} maxLength={120} placeholder="Ex.: Mercado Bom Preço" onChange={(e) => setStore(e.target.value)} autoFocus />
        </label>
        <label className="ml-field">
          Data da compra
          <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="sm-finish-actions">
          <button type="button" className="auth-link" onClick={onCancel} disabled={busy}>
            Voltar
          </button>
          <button type="button" className="water-primary" onClick={() => void save()} disabled={busy || bought.length === 0}>
            {busy ? 'Salvando…' : 'Salvar no histórico'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SupermarketMode({ list, items, canEdit, api, onClose }: { list: ShoppingList; items: ListItem[]; canEdit: boolean; api: Api; onClose: () => void }) {
  const [hideDone, setHideDone] = useState(false)
  const [newName, setNewName] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [saved, setSaved] = useState(false)
  const t = totalsOf(items)
  const shown = hideDone ? items.filter((i) => !i.bought) : items

  async function add() {
    const name = newName.trim()
    if (!name) return
    await api.addItem(list.id, { name, category: guessCategory(name), quantity: 1, unit: 'un', notes: null })
    setNewName('')
  }

  return (
    <div className="sm" role="dialog" aria-modal="true" aria-label={`Modo supermercado: ${list.name}`}>
      <header className="sm-head">
        <button type="button" className="sm-close" onClick={onClose} aria-label="Sair do modo supermercado">
          ‹
        </button>
        <div>
          <strong>{list.name}</strong>
          <span>
            {t.bought} de {t.total} no carrinho · faltam {t.pending}
          </span>
        </div>
      </header>
      <div className="sm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.progress * 100)}>
        <span style={{ width: `${Math.round(t.progress * 100)}%` }} />
      </div>
      <div className="sm-total">
        <span>
          Total pago <strong>{formatBrl(t.spentCents)}</strong>
        </span>
        <span>
          Estimado <strong>{formatBrl(t.estimatedCents)}</strong>
        </span>
      </div>
      <label className="sm-toggle">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Mostrar só o que falta
      </label>
      <div className="sm-scroll">
        {groupByCategory(shown).map((g) => (
          <section key={g.key} className="sm-cat">
            <h4>{g.label}</h4>
            <ul>
              {g.items.map((i) => (
                <Row key={i.id} item={i} canEdit={canEdit} api={api} />
              ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="home-muted sm-empty">{items.length === 0 ? 'A lista está vazia.' : 'Tudo comprado! 🎉'}</p>}
        {canEdit && (
          <form
            className="sm-add"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <input value={newName} placeholder="Adicionar produto" aria-label="Adicionar produto" onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" disabled={!newName.trim()}>
              Adicionar
            </button>
          </form>
        )}
        {canEdit && t.bought > 0 && (
          <div className="sm-finish-bar">
            {saved ? (
              <p className="auth-success" role="status">
                Compra salva no histórico. Veja os gráficos em Minha Lista → Histórico e preços.
              </p>
            ) : (
              <button type="button" className="water-primary sm-finish-btn" onClick={() => setFinishing(true)}>
                Finalizar compra e salvar no histórico
              </button>
            )}
          </div>
        )}
      </div>
      {finishing && (
        <FinishPurchase
          list={list}
          items={items}
          api={api}
          onCancel={() => setFinishing(false)}
          onDone={() => {
            setFinishing(false)
            setSaved(true)
          }}
        />
      )}
    </div>
  )
}
